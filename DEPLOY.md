# Deploy — One Command

## Option 1: Surge.sh (Fastest — 30 seconds)
Open a terminal in this folder and run:
```
npx surge ./ k1visaservices.surge.sh
```
It will ask for your email and a password (creates a free account instantly). Done. Site is live.

## Option 2: Netlify (Better long-term)
```
npx netlify-cli deploy --dir=. --prod
```
Opens browser to auth. Pick a site name. Done.

## Option 3: GitHub Pages (Best for SEO)
1. Create a GitHub account at github.com
2. Install gh CLI: `winget install GitHub.cli`
3. Run: `gh auth login`
4. Then: `gh repo create k1-visa-services --public --source=. --push`
5. Go to repo Settings > Pages > Deploy from branch > main
