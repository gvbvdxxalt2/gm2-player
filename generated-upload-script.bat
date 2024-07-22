@echo off
echo Pushing gm2-player to github...
git lfs uninstall
git init
git rm -r --cached .
git add .
git commit -m "Upload main source code."
git branch -M main
git remote add origin https://github.com/gvbmod/gm2-player.git
git push -f --no-verify origin main