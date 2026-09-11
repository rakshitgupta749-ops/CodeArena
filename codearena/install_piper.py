import urllib.request
import tarfile
import os

url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
filename = "piper_linux_x86_64.tar.gz"

print("Downloading Piper...")
urllib.request.urlretrieve(url, filename)

print("Extracting...")
with tarfile.open(filename, "r:gz") as tar:
    tar.extractall(path="piper_bin")

os.remove(filename)
print("Done. Piper is extracted to ./piper_bin/")
