@echo off
echo ============================================================
echo Julius Baer Agentic System - Dependency Installer
echo ============================================================
echo.
echo Installing core dependencies...
echo This may take a few minutes...
echo.

python -m pip install --upgrade pip

python -m pip install langchain
python -m pip install langchain-openai
python -m pip install langchain-groq
python -m pip install langchain-community
python -m pip install pandas
python -m pip install python-dotenv
python -m pip install requests
python -m pip install beautifulsoup4
python -m pip install PyPDF2
python -m pip install pillow
python -m pip install opencv-python
python -m pip install numpy
python -m pip install scipy
python -m pip install pyspellchecker

echo.
echo ============================================================
echo Installation complete!
echo ============================================================
echo.
echo Testing installation...
python quick_test.py

pause


