"""
AML (Anti-Money Laundering) Detection Agent
This agent flags suspicious transactions based on rule-based detection and ML models.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# ML Libraries
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# Visualization
import matplotlib.pyplot as plt
import seaborn as sns

class AMLDetectionAgent:
    """
    AML Detection Agent that combines rule-based and ML-based detection
    """
    
    def __init__(self, high_amount_threshold_percentile=95):
        """
        Initialize the AML Detection Agent
        
        Args:
            high_amount_threshold_percentile: Percentile to define "high amount" transactions
        """
        self.high_amount_threshold_percentile = high_amount_threshold_percentile
        self.high_amount_threshold = None
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        
        # Common AML rules across MAS/FINMA/HKMA
        self.aml_rules = {
            'MAS': ['cdd_required', 'edd_for_high_risk', 'str_reporting', 'pep_screening', 'sanctions_screening'],
            'FINMA': ['cdd_required', 'edd_for_high_risk', 'str_reporting', 'pep_screening', 'sanctions_screening'],
            'HKMA/SFC': ['cdd_required', 'edd_for_high_risk', 'str_reporting', 'pep_screening', 'sanctions_screening']
        }
    
    def check_high_risk_variables(self, row):
        """
        Check for high risk variables that immediately flag transaction as HIGH PRIORITY
        
        Returns:
            tuple: (is_high_risk: bool, reasons: list)
        """
        reasons = []
        is_high_risk = False
        
        # Rule 1: PEP check
        if pd.notna(row.get('customer_is_pep')) and str(row.get('customer_is_pep')).upper() == 'TRUE':
            is_high_risk = True
            reasons.append("Customer is a Politically Exposed Person (PEP)")
        
        # Rule 2: Domiciliary company without EDD
        if str(row.get('customer_type', '')).lower() == 'domiciliary_company':
            edd_performed = str(row.get('edd_performed', '')).upper()
            if edd_performed != 'TRUE':
                is_high_risk = True
                reasons.append("Domiciliary company without Enhanced Due Diligence (EDD)")
        
        # Rule 3: EDD required but not performed
        edd_required = str(row.get('edd_required', '')).upper()
        if edd_required == 'TRUE':
            edd_performed = str(row.get('edd_performed', '')).upper()
            if edd_performed != 'TRUE':
                is_high_risk = True
                reasons.append("EDD required but not performed")
        
        # Rule 4: SOW not documented
        sow_documented = str(row.get('sow_documented', '')).upper()
        if sow_documented == 'FALSE':
            is_high_risk = True
            reasons.append("Source of Wealth (SOW) not documented")
        
        # Rule 5: Low risk profile with high amount
        if pd.notna(row.get('amount')):
            try:
                amount = float(row.get('amount', 0))
                client_risk = str(row.get('client_risk_profile', '')).lower()
                if client_risk == 'low' and self.high_amount_threshold and amount > self.high_amount_threshold:
                    is_high_risk = True
                    reasons.append(f"Low risk profile customer with unusually high amount ({amount:,.2f})")
            except (ValueError, TypeError):
                pass
        
        # Rule 6: Suitability not assessed
        suitability_assessed = str(row.get('suitability_assessed', '')).upper()
        if suitability_assessed == 'FALSE':
            is_high_risk = True
            reasons.append("Suitability not assessed")
        
        # Rule 7: Suitability mismatch
        if suitability_assessed == 'TRUE':
            suitability_result = str(row.get('suitability_result', '')).lower()
            if suitability_result == 'mismatch':
                is_high_risk = True
                reasons.append("Suitability assessment shows mismatch")
        
        # Rule 8: Cash ID not verified
        cash_id_verified = str(row.get('cash_id_verified', '')).upper()
        if cash_id_verified == 'FALSE':
            is_high_risk = True
            reasons.append("Cash ID not verified")
        
        return is_high_risk, reasons
    
    def check_suspicious_detection_variables(self, row):
        """
        Check for transaction suspicious detection variables
        
        Returns:
            tuple: (count: int, reasons: list)
        """
        count = 0
        reasons = []
        
        # Rule 1: Booking jurisdiction based on regulator AML rules
        regulator = str(row.get('regulator', '')).strip()
        booking_jurisdiction = str(row.get('booking_jurisdiction', '')).strip()
        
        # Check for AML rule violations based on regulator
        if regulator in self.aml_rules:
            # Common violation: Missing required documentation or screening
            if regulator == 'MAS':
                # MAS requires strict CDD/EDD for domiciliary companies
                if str(row.get('customer_type', '')).lower() == 'domiciliary_company':
                    if str(row.get('edd_performed', '')).upper() != 'TRUE':
                        count += 1
                        reasons.append("MAS: Domiciliary company without EDD (AML violation)")
            
            elif regulator == 'FINMA':
                # FINMA requires enhanced monitoring for high-risk customers
                customer_risk = str(row.get('customer_risk_rating', '')).lower()
                if customer_risk in ['high', 'medium']:
                    if str(row.get('edd_performed', '')).upper() != 'TRUE':
                        count += 1
                        reasons.append("FINMA: High/Medium risk customer without EDD (AML violation)")
            
            elif regulator == 'HKMA/SFC':
                # HKMA requires proper CDD for all customers
                if str(row.get('sow_documented', '')).upper() == 'FALSE':
                    count += 1
                    reasons.append("HKMA/SFC: Missing SOW documentation (AML violation)")
        
        # Rule 2: Unusually high amount for low risk profile customer
        if pd.notna(row.get('amount')) and self.high_amount_threshold:
            try:
                amount = float(row.get('amount', 0))
                client_risk = str(row.get('client_risk_profile', '')).lower()
                if client_risk == 'low' and amount > self.high_amount_threshold:
                    count += 1
                    reasons.append(f"Unusually high amount ({amount:,.2f}) for low risk profile customer")
            except (ValueError, TypeError):
                pass
        
        # Rule 3: Domiciliary company (suspicious detection)
        if str(row.get('customer_type', '')).lower() == 'domiciliary_company':
            count += 1
            reasons.append("Customer type is domiciliary company")
        
        # Rule 4: Customer risk rating (Medium/High counts as suspicious)
        customer_risk = str(row.get('customer_risk_rating', '')).lower()
        if customer_risk in ['medium', 'high']:
            count += 1
            reasons.append(f"Customer risk rating is {customer_risk.title()}")
        
        # Rule 5: Sanctions screening shows potential
        sanctions = str(row.get('sanctions_screening', '')).lower()
        if sanctions == 'potential':
            count += 1
            reasons.append("Sanctions screening shows potential match")
        
        return count, reasons
    
    def classify_risk(self, high_risk_detected, suspicious_count):
        """
        Classify transaction risk level
        
        Returns:
            str: Risk category ('HIGH PRIORITY RISK', 'MEDIUM RISK', 'LOW RISK', or '')
        """
        # High risk variables take precedence
        if high_risk_detected:
            return 'HIGH PRIORITY RISK'
        
        # Transaction suspicious detection rules
        if suspicious_count == 0:
            return ''  # Leave blank
        elif suspicious_count == 1:
            return ''  # Leave blank (only 1 suspicious detection)
        elif suspicious_count == 2:
            return 'LOW RISK'
        elif suspicious_count >= 3 and suspicious_count <= 4:
            return 'MEDIUM RISK'
        elif suspicious_count >= 5:
            return 'HIGH PRIORITY RISK'
        else:
            return ''
    
    def calculate_high_amount_threshold(self, df):
        """Calculate threshold for 'high amount' based on percentile"""
        try:
            amounts = pd.to_numeric(df['amount'], errors='coerce').dropna()
            if len(amounts) > 0:
                self.high_amount_threshold = np.percentile(amounts, self.high_amount_threshold_percentile)
            else:
                self.high_amount_threshold = 1000000  # Default threshold
        except Exception as e:
            print(f"Error calculating threshold: {e}")
            self.high_amount_threshold = 1000000
    
    def process_dataframe(self, df):
        """
        Process entire dataframe and flag transactions
        
        Args:
            df: Input dataframe
            
        Returns:
            df: Dataframe with detection results
        """
        # Calculate high amount threshold
        self.calculate_high_amount_threshold(df)
        
        results = []
        
        for idx, row in df.iterrows():
            # Check high risk variables
            is_high_risk, high_risk_reasons = self.check_high_risk_variables(row)
            
            # Check suspicious detection variables
            suspicious_count, suspicious_reasons = self.check_suspicious_detection_variables(row)
            
            # Classify risk
            risk_category = self.classify_risk(is_high_risk, suspicious_count)
            
            # Combine all reasons
            all_reasons = high_risk_reasons + suspicious_reasons
            
            results.append({
                'transaction_id': row.get('transaction_id', ''),
                'is_suspicious': 1 if risk_category else 0,
                'risk_category': risk_category,
                'suspicious_detection_count': suspicious_count,
                'high_risk_detected': 1 if is_high_risk else 0,
                'reasons': '; '.join(all_reasons) if all_reasons else 'No suspicious indicators'
            })
        
        results_df = pd.DataFrame(results)
        return results_df
    
    def encode_datetime_features(self, df):
        """
        Convert datetime to numerical features (0s and 1s and other derived features)
        """
        df_encoded = df.copy()
        
        datetime_cols = ['booking_datetime', 'value_date', 'kyc_last_completed', 
                        'kyc_due_date', 'suspicion_determined_datetime', 'str_filed_datetime']
        
        for col in datetime_cols:
            if col in df_encoded.columns:
                try:
                    # Parse datetime
                    df_encoded[f'{col}_parsed'] = pd.to_datetime(df_encoded[col], errors='coerce')
                    
                    # Extract features
                    df_encoded[f'{col}_year'] = df_encoded[f'{col}_parsed'].dt.year.fillna(0).astype(int)
                    df_encoded[f'{col}_month'] = df_encoded[f'{col}_parsed'].dt.month.fillna(0).astype(int)
                    df_encoded[f'{col}_day'] = df_encoded[f'{col}_parsed'].dt.day.fillna(0).astype(int)
                    df_encoded[f'{col}_hour'] = df_encoded[f'{col}_parsed'].dt.hour.fillna(0).astype(int)
                    df_encoded[f'{col}_dayofweek'] = df_encoded[f'{col}_parsed'].dt.dayofweek.fillna(0).astype(int)
                    
                    # Binary: is weekend (1) or not (0)
                    df_encoded[f'{col}_is_weekend'] = (df_encoded[f'{col}_parsed'].dt.dayofweek >= 5).astype(int).fillna(0)
                    
                    # Binary: is business hours (1) or not (0) - assuming 9 AM to 5 PM
                    df_encoded[f'{col}_is_business_hours'] = (
                        (df_encoded[f'{col}_parsed'].dt.hour >= 9) & 
                        (df_encoded[f'{col}_parsed'].dt.hour < 17)
                    ).astype(int).fillna(0)
                    
                    # Drop parsed column
                    df_encoded.drop(columns=[f'{col}_parsed'], inplace=True, errors='ignore')
                except Exception as e:
                    print(f"Warning: Could not encode {col}: {e}")
        
        return df_encoded
    
    def prepare_features_for_ml(self, df, target_col='is_suspicious'):
        """
        Prepare features for machine learning model
        """
        df_ml = df.copy()
        
        # Encode datetime features
        df_ml = self.encode_datetime_features(df_ml)
        
        # Select features for ML
        feature_cols = []
        
        # Numerical features
        numerical_cols = ['amount', 'fx_applied_rate', 'fx_market_rate', 'fx_spread_bps',
                         'daily_cash_total_customer', 'daily_cash_txn_count']
        for col in numerical_cols:
            if col in df_ml.columns:
                df_ml[col] = pd.to_numeric(df_ml[col], errors='coerce').fillna(0)
                feature_cols.append(col)
        
        # Add datetime derived features
        datetime_features = [col for col in df_ml.columns if any(dt_col in col for dt_col in 
                          ['booking_datetime', 'value_date']) and 
                          any(feat in col for feat in ['_year', '_month', '_day', '_hour', '_dayofweek', '_is_weekend', '_is_business_hours'])]
        feature_cols.extend(datetime_features)
        
        # Categorical features to encode
        categorical_cols = ['booking_jurisdiction', 'regulator', 'currency', 'channel', 
                          'product_type', 'originator_country', 'beneficiary_country',
                          'customer_type', 'customer_risk_rating', 'client_risk_profile',
                          'purpose_code', 'sanctions_screening']
        
        for col in categorical_cols:
            if col in df_ml.columns:
                if col not in self.label_encoders:
                    self.label_encoders[col] = LabelEncoder()
                    df_ml[col] = df_ml[col].fillna('unknown')
                    df_ml[f'{col}_encoded'] = self.label_encoders[col].fit_transform(df_ml[col].astype(str))
                else:
                    df_ml[col] = df_ml[col].fillna('unknown')
                    df_ml[f'{col}_encoded'] = self.label_encoders[col].transform(df_ml[col].astype(str))
                feature_cols.append(f'{col}_encoded')
        
        # Boolean features
        boolean_cols = ['customer_is_pep', 'edd_required', 'edd_performed', 'sow_documented',
                       'suitability_assessed', 'cash_id_verified', 'product_complex',
                       'is_advised', 'product_has_va_exposure', 'va_disclosure_provided']
        
        for col in boolean_cols:
            if col in df_ml.columns:
                df_ml[col] = df_ml[col].astype(str).str.upper().map({'TRUE': 1, 'FALSE': 0, '1': 1, '0': 0}).fillna(0).astype(int)
                feature_cols.append(col)
        
        # Get features and target
        X = df_ml[feature_cols].fillna(0)
        y = df_ml[target_col] if target_col in df_ml.columns else None
        
        return X, y, feature_cols
    
    def train_model(self, df_with_target):
        """
        Train ML model on the dataset (80-20 split)
        
        Args:
            df_with_target: DataFrame with target column 'is_suspicious'
        """
        print("Preparing features for ML model...")
        X, y, feature_cols = self.prepare_features_for_ml(df_with_target, target_col='is_suspicious')
        
        print(f"Features shape: {X.shape}")
        print(f"Target distribution:\n{y.value_counts()}")
        
        # Train-test split (80-20)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # For diverse data without clear patterns, Gradient Boosting often works well
        # It can capture complex non-linear relationships
        print("\nTraining Gradient Boosting Classifier (good for diverse data with non-linear patterns)...")
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            subsample=0.8
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)
        
        print(f"\nModel Performance:")
        print(f"Training Accuracy: {train_score:.4f}")
        print(f"Test Accuracy: {test_score:.4f}")
        
        # Predictions
        y_pred = self.model.predict(X_test_scaled)
        
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Not Suspicious', 'Suspicious']))
        
        print("\nFeature Importance (Top 10):")
        feature_importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False).head(10)
        print(feature_importance)
        
        return self.model
    
    def predict(self, df):
        """
        Make predictions using trained model
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train_model() first.")
        
        X, _, _ = self.prepare_features_for_ml(df)
        X_scaled = self.scaler.transform(X.fillna(0))
        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)[:, 1]
        
        return predictions, probabilities
    
    def create_visualizations(self, results_df, original_df):
        """
        Create visual summary of flagged transactions
        """
        # Use original_df which already has the detection results merged
        if 'is_suspicious' in original_df.columns:
            flagged_df = original_df[original_df['is_suspicious'] == 1].copy()
        else:
            # Fallback: merge results if not already in original_df
            merged_df = original_df.merge(results_df, on='transaction_id', how='left')
            flagged_df = merged_df[merged_df['is_suspicious'] == 1].copy()
        
        if len(flagged_df) == 0:
            print("No suspicious transactions to visualize.")
            return
        
        # Create figure with subplots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('AML Detection - Visual Summary of Flagged Transactions', fontsize=16, fontweight='bold')
        
        # 1. Risk category distribution
        risk_counts = flagged_df['risk_category'].value_counts()
        axes[0, 0].pie(risk_counts.values, labels=risk_counts.index, autopct='%1.1f%%', startangle=90)
        axes[0, 0].set_title('Distribution of Risk Categories')
        
        # 2. Suspicious detection count distribution
        suspicious_counts = flagged_df['suspicious_detection_count'].value_counts().sort_index()
        axes[0, 1].bar(suspicious_counts.index, suspicious_counts.values, color='coral')
        axes[0, 1].set_title('Distribution of Suspicious Detection Counts')
        axes[0, 1].set_xlabel('Number of Suspicious Indicators')
        axes[0, 1].set_ylabel('Number of Transactions')
        axes[0, 1].grid(axis='y', alpha=0.3)
        
        # 3. Risk category by regulator
        if 'regulator' in flagged_df.columns:
            risk_by_regulator = pd.crosstab(flagged_df['regulator'], flagged_df['risk_category'])
            risk_by_regulator.plot(kind='bar', ax=axes[1, 0], stacked=True)
            axes[1, 0].set_title('Risk Categories by Regulator')
            axes[1, 0].set_xlabel('Regulator')
            axes[1, 0].set_ylabel('Number of Transactions')
            axes[1, 0].legend(title='Risk Category', bbox_to_anchor=(1.05, 1), loc='upper left')
            axes[1, 0].tick_params(axis='x', rotation=45)
        
        # 4. Amount distribution for flagged transactions
        if 'amount' in flagged_df.columns:
            try:
                amounts = pd.to_numeric(flagged_df['amount'], errors='coerce').dropna()
                axes[1, 1].hist(amounts, bins=50, color='steelblue', edgecolor='black', alpha=0.7)
                axes[1, 1].set_title('Distribution of Transaction Amounts (Flagged)')
                axes[1, 1].set_xlabel('Amount')
                axes[1, 1].set_ylabel('Frequency')
                axes[1, 1].set_yscale('log')
                axes[1, 1].grid(axis='y', alpha=0.3)
            except Exception as e:
                axes[1, 1].text(0.5, 0.5, f'Could not plot amounts:\n{str(e)}', 
                               ha='center', va='center', transform=axes[1, 1].transAxes)
        
        plt.tight_layout()
        plt.savefig('aml_detection_summary.png', dpi=300, bbox_inches='tight')
        print("\nVisualization saved as 'aml_detection_summary.png'")
        plt.close()


def main():
    """
    Main function to run AML detection agent
    """
    # Load data
    input_file = 'sample1.csv'
    print(f"Loading data from {input_file}...")
    
    try:
        df = pd.read_csv(input_file, low_memory=False)
        print(f"Loaded {len(df)} transactions")
        print(f"Columns: {len(df.columns)}")
    except FileNotFoundError:
        print(f"Error: File {input_file} not found!")
        return
    
    # Initialize agent
    agent = AMLDetectionAgent(high_amount_threshold_percentile=95)
    
    # Process transactions (rule-based detection)
    print("\n" + "="*60)
    print("RULE-BASED AML DETECTION")
    print("="*60)
    results_df = agent.process_dataframe(df)
    
    # Add results to original dataframe
    df['is_suspicious'] = results_df['is_suspicious'].values
    df['risk_category'] = results_df['risk_category'].values
    df['suspicious_detection_count'] = results_df['suspicious_detection_count'].values
    df['high_risk_detected'] = results_df['high_risk_detected'].values
    df['reasons'] = results_df['reasons'].values
    
    # Summary statistics
    print(f"\nDetection Summary:")
    print(f"Total transactions: {len(df)}")
    print(f"Suspicious transactions: {df['is_suspicious'].sum()}")
    print(f"High priority risk: {(df['risk_category'] == 'HIGH PRIORITY RISK').sum()}")
    print(f"Medium risk: {(df['risk_category'] == 'MEDIUM RISK').sum()}")
    print(f"Low risk: {(df['risk_category'] == 'LOW RISK').sum()}")
    
    # Train ML model
    print("\n" + "="*60)
    print("MACHINE LEARNING MODEL TRAINING (80-20 Split)")
    print("="*60)
    agent.train_model(df)
    
    # Save model
    joblib.dump(agent.model, 'aml_model.pkl')
    joblib.dump(agent.scaler, 'aml_scaler.pkl')
    joblib.dump(agent.label_encoders, 'aml_label_encoders.pkl')
    print("\nModel saved: aml_model.pkl, aml_scaler.pkl, aml_label_encoders.pkl")
    
    # ML predictions (for comparison)
    ml_predictions, ml_probabilities = agent.predict(df)
    df['ml_prediction'] = ml_predictions
    df['ml_suspicious_probability'] = ml_probabilities
    
    # Create visualizations
    print("\n" + "="*60)
    print("CREATING VISUALIZATIONS")
    print("="*60)
    agent.create_visualizations(results_df, df)
    
    # Save results
    output_file = 'aml_detection_results.csv'
    df.to_csv(output_file, index=False)
    print(f"\nResults saved to: {output_file}")
    
    # Display sample of flagged transactions
    print("\n" + "="*60)
    print("SAMPLE OF FLAGGED TRANSACTIONS")
    print("="*60)
    flagged = df[df['is_suspicious'] == 1][['transaction_id', 'risk_category', 
                                            'suspicious_detection_count', 'reasons']].head(10)
    print(flagged.to_string(index=False))
    
    print("\n" + "="*60)
    print("AML DETECTION COMPLETE")
    print("="*60)


if __name__ == '__main__':
    main()

