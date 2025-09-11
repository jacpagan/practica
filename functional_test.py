from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Use Chrome WebDriver with automatic driver management
service = Service(ChromeDriverManager().install())
browser = webdriver.Chrome(service=service)

browser.get("http://localhost:8000")

# Print the actual title and page source for debugging
print(f"Page title: '{browser.title}'")
print(f"Page URL: '{browser.current_url}'")
print(f"Page source preview: '{browser.page_source[:200]}...'")

# Check if server is responding (even with errors)
assert browser.title != "" and browser.current_url == "http://localhost:8000/"
print("✅ Server is responding!")

browser.quit()