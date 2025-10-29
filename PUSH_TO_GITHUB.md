# Push to GitHub Instructions

## Option 1: Using HTTPS (Recommended for beginners)

1. Create a new repository on GitHub (don't initialize with README)
   - Go to: https://github.com/new
   - Repository name: `tts-standalone`
   - Choose public or private
   - Click "Create repository"

2. Run these commands in PowerShell:

```powershell
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tts-standalone.git

# Rename branch to main (if GitHub uses main)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Option 2: Using SSH

If you have SSH keys set up:

```powershell
git remote add origin git@github.com:YOUR_USERNAME/tts-standalone.git
git branch -M main
git push -u origin main
```

## Important Notes

- If your branch is named `master`, you might need to run: `git branch -M main` first
- You'll be prompted for credentials when you push
- For HTTPS, you may need to use a Personal Access Token instead of your password

## After Pushing

Your repository will be available at:
`https://github.com/YOUR_USERNAME/tts-standalone`

