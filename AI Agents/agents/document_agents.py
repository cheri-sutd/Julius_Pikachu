"""
Part 2: Document Validation Agents
- Spell Checker: Validates spelling in documents
- Image Forensics: Detects image tampering and authenticity
- Info Validator: Validates information accuracy and completeness
"""
from __future__ import annotations
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from .llm_helper import get_llm_with_fallback
from langchain.memory import ConversationBufferMemory
from typing import Dict, List, Optional, Any, Tuple
import json
from datetime import datetime
import sqlite3
import sys
import os
import numpy as np


# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config

class AuditLogger:
    """Utility class for logging agent actions to audit trail"""
    
    @staticmethod
    def log(agent_name: str, action: str, input_data: Any, 
            output_data: Any, risk_score: Optional[float] = None, 
            alert_type: Optional[str] = None):
        """Log agent action to audit database"""
        
        def safe_json_serialize(obj):
            """Safely serialize objects to JSON, handling numpy types"""
            if isinstance(obj, dict):
                return json.dumps({k: safe_json_serialize(v) for k, v in obj.items()}, default=str)
            elif isinstance(obj, (list, tuple)):
                return json.dumps([safe_json_serialize(item) for item in obj], default=str)
            else:
                try:
                    json.dumps(obj)
                    return json.dumps(obj) if isinstance(obj, (dict, list)) else str(obj)
                except (TypeError, ValueError):
                    return str(obj)
        
        conn = sqlite3.connect(Config.AUDIT_LOG_PATH)
        try:
            conn.execute("""
                INSERT INTO audit_logs 
                (timestamp, agent_name, action, input_data, output_data, risk_score, alert_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                datetime.now().isoformat(),
                agent_name,
                action,
                safe_json_serialize(input_data),
                safe_json_serialize(output_data),
                float(risk_score) if risk_score is not None else None,
                alert_type
            ))
            conn.commit()
        except Exception as e:
            print(f"   Warning: Audit log failed: {str(e)[:100]}")
        finally:
            conn.close()

# ============================================
# PART 2: DOCUMENT VALIDATION AGENTS
# ============================================

class SpellCheckerAgent:
    """
    Agent responsible for spell checking and grammar validation in documents.
    Validates PDFs and text documents for spelling and grammatical errors.
    """
    
    def __init__(self):
        self.agent_name = "SpellChecker"
        self.llm = self._get_llm()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history"
        )
        # Initialize spell checker library
        try:
            from spellchecker import SpellChecker
            self.spell_checker = SpellChecker()
        except ImportError:
            self.spell_checker = None
        
    def _get_llm(self):
        """Initialize LLM (Groq or OpenAI) with fallback"""
        return get_llm_with_fallback()
    
    def check_text_spelling(self, text: str) -> Dict[str, Any]:
        """
        Check spelling and grammar in text.
        
        Args:
            text: Text content to check
            
        Returns:
            Dictionary with spelling errors, suggestions, and validation score
        """
        try:
            errors = []
            suggestions = {}
            
            # Basic spell checking
            if self.spell_checker:
                import re
                words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
                misspelled = self.spell_checker.unknown(words)
                
                for word in misspelled:
                    suggestions[word] = list(self.spell_checker.candidates(word))[:5]
                    errors.append({
                        "word": word,
                        "position": text.lower().find(word),
                        "suggestions": suggestions[word]
                    })
            
            # LLM-based grammar and context checking
            prompt = f"""
            Review the following text for spelling, grammar, and professional language errors:
            
            Text:
            {text}
            
            Provide:
            1. List of spelling errors with suggestions
            2. Grammar mistakes
            3. Professional language issues
            4. Overall quality score (0-100)
            5. Recommendations for improvement
            
            Format as JSON with:
            - spelling_errors (list of dicts with word, suggestion, context)
            - grammar_errors (list)
            - quality_score (number)
            - recommendations (list)
            """
            
            response = self.llm.invoke(prompt)
            llm_analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Try to parse JSON from LLM response
            try:
                import re
                json_match = re.search(r'\{.*\}', llm_analysis, re.DOTALL)
                if json_match:
                    llm_results = json.loads(json_match.group())
                else:
                    llm_results = {"raw_analysis": llm_analysis}
            except:
                llm_results = {"raw_analysis": llm_analysis}
            
            # Calculate validation score
            error_count = len(errors) + len(llm_results.get("spelling_errors", []))
            quality_score = llm_results.get("quality_score", 100 - (error_count * 2))
            quality_score = max(0, min(100, quality_score))
            
            result = {
                "spelling_errors": errors,
                "llm_errors": llm_results.get("spelling_errors", []),
                "grammar_errors": llm_results.get("grammar_errors", []),
                "quality_score": quality_score,
                "suggestions": suggestions,
                "recommendations": llm_results.get("recommendations", []),
                "raw_analysis": llm_results.get("raw_analysis", llm_analysis),
                "timestamp": datetime.now().isoformat()
            }
            
            # Audit log
            AuditLogger.log(
                self.agent_name,
                "check_spelling",
                {"text_length": len(text)},
                result,
                alert_type="SPELLING_ERRORS" if error_count > 5 else None
            )
            
            return result
            
        except Exception as e:
            error_result = {"error": str(e), "quality_score": 0}
            AuditLogger.log(self.agent_name, "check_spelling", {"text_length": len(text)}, error_result)
            raise
    
    def check_pdf_spelling(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract text from PDF and check spelling.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary with spelling validation results
        """
        try:
            import PyPDF2
            
            # Extract text from PDF
            text_content = []
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    text = page.extract_text()
                    text_content.append(f"--- Page {page_num + 1} ---\n{text}")
            
            full_text = "\n".join(text_content)
            
            # Use text checking method
            result = self.check_text_spelling(full_text)
            result["pdf_path"] = pdf_path
            result["page_count"] = len(text_content)
            
            return result
            
        except Exception as e:
            return {
                "error": str(e),
                "pdf_path": pdf_path,
                "quality_score": 0
            }


class ImageForensicsAgent:
    """
    Agent responsible for detecting image tampering and authenticity.
    Uses image analysis and forensics techniques to identify manipulation.
    """
    
    def __init__(self):
        self.agent_name = "ImageForensics"
        self.llm = self._get_llm()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history"
        )
        
    def _get_llm(self):
        """Initialize LLM (Groq or OpenAI) with fallback"""
        return get_llm_with_fallback()
    
    def analyze_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze image for tampering and authenticity.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with tampering score, detected anomalies, and analysis
        """
        try:
            from PIL import Image
            import cv2
            import numpy as np
            
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                return {"error": "Could not load image", "tampering_score": 1.0}
            
            pil_img = Image.open(image_path)
            
            # Basic image metadata
            metadata = {
                "format": pil_img.format,
                "size": pil_img.size,
                "mode": pil_img.mode,
                "has_exif": hasattr(pil_img, '_getexif') and pil_img._getexif() is not None
            }
            
            # Forensics checks
            anomalies = []
            tampering_indicators = []
            tampering_score = 0.0
            
            # 1. Error Level Analysis (ELA) - detects resaving/editing
            ela_score = self._error_level_analysis(img)
            if ela_score > 0.15:
                anomalies.append({
                    "type": "ERROR_LEVEL_ANOMALY",
                    "severity": "HIGH",
                    "description": "High error level indicates potential resaving/editing",
                    "score": ela_score
                })
                tampering_score += 0.3
            
            # 2. Metadata analysis
            if not metadata["has_exif"]:
                tampering_indicators.append({
                    "type": "MISSING_METADATA",
                    "severity": "MEDIUM",
                    "description": "No EXIF data found - image may have been stripped"
                })
                tampering_score += 0.1
            
            # 3. Compression artifacts analysis
            compression_score = self._analyze_compression(img)
            if compression_score > 0.2:
                anomalies.append({
                    "type": "COMPRESSION_ANOMALY",
                    "severity": "MEDIUM",
                    "description": "Inconsistent compression patterns detected",
                    "score": compression_score
                })
                tampering_score += 0.2
            
            # 4. Image quality metrics
            quality_metrics = self._calculate_quality_metrics(img)
            
            # LLM analysis of findings
            prompt = f"""
            Analyze the following image forensics findings:
            
            Image Metadata:
            - Format: {metadata['format']}
            - Size: {metadata['size']}
            - Has EXIF: {metadata['has_exif']}
            
            Detected Anomalies:
            {json.dumps(anomalies, indent=2)}
            
            Tampering Indicators:
            {json.dumps(tampering_indicators, indent=2)}
            
            Quality Metrics:
            {json.dumps(quality_metrics, indent=2)}
            
            Provide:
            1. Overall tampering risk assessment (LOW/MEDIUM/HIGH)
            2. Detailed analysis of anomalies
            3. Recommendations for further investigation
            4. Authenticity confidence score (0-100)
            
            Format as JSON with:
            - risk_assessment
            - analysis
            - recommendations
            - authenticity_score
            """
            
            response = self.llm.invoke(prompt)
            llm_analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Parse LLM response
            try:
                import re
                json_match = re.search(r'\{.*\}', llm_analysis, re.DOTALL)
                if json_match:
                    llm_results = json.loads(json_match.group())
                else:
                    llm_results = {"raw_analysis": llm_analysis}
            except:
                llm_results = {"raw_analysis": llm_analysis}
            
            # Calculate final tampering score (0.0 = authentic, 1.0 = tampered)
            tampering_score = min(tampering_score, 1.0)
            authenticity_score = llm_results.get("authenticity_score", 100 - (tampering_score * 100))
            authenticity_score = max(0, min(100, int(authenticity_score)))
            
            result = {
                "tampering_score": tampering_score,
                "authenticity_score": authenticity_score,
                "risk_assessment": llm_results.get("risk_assessment", "MEDIUM"),
                "metadata": metadata,
                "anomalies": anomalies,
                "tampering_indicators": tampering_indicators,
                "quality_metrics": quality_metrics,
                "analysis": llm_results.get("analysis", llm_analysis),
                "recommendations": llm_results.get("recommendations", []),
                "timestamp": datetime.now().isoformat()
            }
            
            # Audit log
            AuditLogger.log(
                self.agent_name,
                "analyze_image",
                {"image_path": image_path, "metadata": metadata},
                result,
                risk_score=tampering_score,
                alert_type="IMAGE_TAMPERING" if tampering_score > 0.5 else None
            )
            
            return result
            
        except Exception as e:
            error_result = {
                "error": str(e),
                "tampering_score": 1.0,
                "authenticity_score": 0
            }
            AuditLogger.log(self.agent_name, "analyze_image", {"image_path": image_path}, error_result)
            raise
    
    def _error_level_analysis(self, img: np.ndarray) -> float:
        """Error Level Analysis for detecting resaving"""
        try:
            import cv2
            
            # Save and reload to create error level
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp_path = tmp.name
                cv2.imwrite(tmp_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
                recompressed = cv2.imread(tmp_path)
                os.unlink(tmp_path)
            
            # Calculate difference
            diff = cv2.absdiff(img, recompressed)
            ela_score = np.mean(diff) / 255.0
            
            return ela_score
        except:
            return 0.0
    
    def _analyze_compression(self, img: np.ndarray) -> float:
        """Analyze compression artifacts"""
        try:
            import cv2
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply DCT and analyze
            from scipy import fft
            dct = fft.dctn(gray.astype(float))
            
            # Check for compression patterns
            high_freq_energy = np.abs(dct[8:, 8:]).mean()
            compression_score = min(high_freq_energy / 1000.0, 1.0)
            
            return compression_score
        except:
            return 0.0
    
    def _calculate_quality_metrics(self, img: np.ndarray) -> Dict[str, float]:
        """Calculate image quality metrics"""
        try:
            import cv2
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Laplacian variance (sharper images have higher variance)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Brightness and contrast
            brightness = np.mean(gray)
            contrast = np.std(gray)
            
            return {
                "sharpness": laplacian_var,
                "brightness": float(brightness),
                "contrast": float(contrast)
            }
        except:
            return {"sharpness": 0.0, "brightness": 0.0, "contrast": 0.0}


class InfoValidatorAgent:
    """
    Agent responsible for validating information accuracy and completeness.
    Validates document information against known sources and checks completeness.
    """
    
    def __init__(self):
        self.agent_name = "InfoValidator"
        self.llm = self._get_llm()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history"
        )
        
    def _get_llm(self):
        """Initialize LLM (Groq or OpenAI) with fallback"""
        return get_llm_with_fallback()
    
    def validate_document_info(self, document_text: str, 
                               document_type: Optional[str] = None,
                               required_fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Validate information in document for accuracy and completeness.
        
        Args:
            document_text: Text content of document
            document_type: Type of document (e.g., "KYC", "Transaction", "Contract")
            required_fields: List of required fields to check
            
        Returns:
            Dictionary with validation results, missing fields, and accuracy score
        """
        try:
            # Default required fields based on document type
            if required_fields is None:
                if document_type == "KYC":
                    required_fields = ["name", "address", "id_number", "date_of_birth", "nationality"]
                elif document_type == "Transaction":
                    required_fields = ["amount", "date", "parties", "purpose"]
                elif document_type == "Contract":
                    required_fields = ["parties", "terms", "date", "signatures"]
                else:
                    required_fields = []
            
            # Check for required fields
            document_lower = document_text.lower()
            found_fields = []
            missing_fields = []
            
            for field in required_fields:
                field_variations = [
                    field,
                    field.replace("_", " "),
                    field.replace("_", "-"),
                    field.replace("_", "")
                ]
                
                found = any(var.lower() in document_lower for var in field_variations)
                if found:
                    found_fields.append(field)
                else:
                    missing_fields.append(field)
            
            # LLM-based validation
            prompt = f"""
            Validate the following document for information accuracy and completeness:
            
            Document Type: {document_type or "General Document"}
            Document Content:
            {document_text[:5000]}  # Limit length
            
            Required Fields to Check: {', '.join(required_fields) if required_fields else 'None specified'}
            
            Analyze:
            1. Completeness: Are all required fields present?
            2. Accuracy: Are the values reasonable and consistent?
            3. Internal Consistency: Do different parts of the document align?
            4. External Validity: Are dates, numbers, and facts logically sound?
            5. Missing Information: What critical information is missing?
            
            Provide:
            - Completeness Score (0-100)
            - Accuracy Score (0-100)
            - Found Fields (list)
            - Missing Fields (list)
            - Inconsistencies (list)
            - Recommendations (list)
            
            Format as JSON.
            """
            
            response = self.llm.invoke(prompt)
            llm_analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Parse LLM response
            try:
                import re
                json_match = re.search(r'\{.*\}', llm_analysis, re.DOTALL)
                if json_match:
                    llm_results = json.loads(json_match.group())
                else:
                    llm_results = {"raw_analysis": llm_analysis}
            except:
                llm_results = {"raw_analysis": llm_analysis}
            
            # Calculate validation scores
            completeness_score = llm_results.get("completeness_score", 
                                                (len(found_fields) / len(required_fields) * 100) if required_fields else 100)
            accuracy_score = llm_results.get("accuracy_score", 100)
            
            overall_score = (completeness_score + accuracy_score) / 2
            
            result = {
                "overall_score": overall_score,
                "completeness_score": completeness_score,
                "accuracy_score": accuracy_score,
                "found_fields": found_fields,
                "missing_fields": missing_fields or llm_results.get("missing_fields", []),
                "inconsistencies": llm_results.get("inconsistencies", []),
                "recommendations": llm_results.get("recommendations", []),
                "document_type": document_type,
                "analysis": llm_results.get("raw_analysis", llm_analysis),
                "timestamp": datetime.now().isoformat()
            }
            
            # Audit log
            AuditLogger.log(
                self.agent_name,
                "validate_document",
                {"document_type": document_type, "text_length": len(document_text)},
                result,
                alert_type="VALIDATION_FAILURE" if overall_score < 70 else None
            )
            
            return result
            
        except Exception as e:
            error_result = {
                "error": str(e),
                "overall_score": 0,
                "completeness_score": 0,
                "accuracy_score": 0
            }
            AuditLogger.log(self.agent_name, "validate_document", {"document_type": document_type}, error_result)
            raise
    
    def validate_pdf_info(self, pdf_path: str, 
                         document_type: Optional[str] = None,
                         required_fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Extract text from PDF and validate information.
        
        Args:
            pdf_path: Path to PDF file
            document_type: Type of document
            required_fields: List of required fields
            
        Returns:
            Dictionary with validation results
        """
        try:
            import PyPDF2
            
            # Extract text from PDF
            text_content = []
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text_content.append(page.extract_text())
            
            full_text = "\n".join(text_content)
            
            # Use text validation method
            result = self.validate_document_info(full_text, document_type, required_fields)
            result["pdf_path"] = pdf_path
            result["page_count"] = len(text_content)
            
            return result
            
        except Exception as e:
            return {
                "error": str(e),
                "pdf_path": pdf_path,
                "overall_score": 0
            }


