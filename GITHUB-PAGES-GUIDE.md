# GitHub Pages Guide

This guide is written for someone who does not normally work with code.

## Before you start

You need:

1. A GitHub account
2. This project folder on your computer
3. Node.js installed on your computer

## Part 1: Refresh the data

This makes sure the website has the latest market snapshot before you upload it.

1. Open the project folder.
2. Click in the folder path bar, type `powershell`, and press Enter.
3. In the window that opens, type:

```bash
npm install
```

4. Wait for it to finish.
5. Type:

```bash
npm run update-data
```

6. Wait until you see a message that says the data file was saved.

## Part 2: Put the project on GitHub

If you already have a GitHub repository for this project, skip to Part 3.

1. Go to https://github.com
2. Sign in
3. Click the `+` button in the upper-right corner
4. Click `New repository`
5. Name it something like `alabama-index`
6. Leave it Public
7. Click `Create repository`

## Part 3: Upload the files

### Easiest option: use GitHub Desktop

1. Install GitHub Desktop from https://desktop.github.com
2. Open GitHub Desktop and sign in
3. Click `Add an Existing Repository from your Hard Drive`
4. If the folder is not already a Git repository, choose the project folder and let GitHub Desktop create one
5. When the files appear, make sure these are included:
   - `index.html`
   - `templates` folder
   - `data` folder
   - `scripts` folder
   - `package.json`
   - `package-lock.json`
   - `.gitignore`
   - `.nojekyll`
6. In the summary box, type `Initial website upload`
7. Click `Commit to main`
8. Click `Publish repository`
9. Choose your GitHub repository name and keep it Public
10. Click `Publish Repository`

### If you do not want to install GitHub Desktop

You can also upload files through the GitHub website, but do not upload the `node_modules` folder.

## Part 4: Turn on GitHub Pages

1. Open your repository on GitHub
2. Click `Settings`
3. Click `Pages` in the left sidebar
4. Under `Build and deployment`, find `Source`
5. Choose `Deploy from a branch`
6. Under `Branch`, choose `main`
7. Under the folder dropdown, choose `/ (root)`
8. Click `Save`

GitHub will publish the site. This can take a minute or two.

## Part 5: Turn on automatic data updates

This project already includes a GitHub Action file that updates the market data automatically every weekday.

1. In your GitHub repository, click `Settings`
2. Click `Actions`, then `General`
3. Make sure Actions are allowed for this repository
4. Scroll to `Workflow permissions`
5. Choose `Read and write permissions`
6. Click `Save`
7. Click the `Actions` tab at the top of the repository
8. If GitHub shows a button asking you to enable workflows, click it

The included workflow is set to run every weekday on a timer and save the updated `data/al_index_data.json` file automatically.

If you want to run it immediately instead of waiting for the timer:

1. Open the `Actions` tab
2. Click `Update Market Data`
3. Click `Run workflow`

## Part 6: Open your website

After GitHub Pages finishes, your site address will usually look like this:

```text
https://YOUR-GITHUB-NAME.github.io/alabama-index/
```

GitHub shows the exact address on the Pages settings screen.

## When you want to update the website later

You have two choices:

### Easy option

Do nothing. The included GitHub Action will refresh the data automatically on weekdays.

### Manual option

1. Open PowerShell in the project folder again
2. Run:

```bash
npm run update-data
```

3. Open GitHub Desktop
4. Review the changed file, which will usually be `data/al_index_data.json`
5. Type a short message like `Update market data`
6. Click `Commit to main`
7. Click `Push origin`

GitHub Pages will update the website automatically after the push.

## Important note

Do not upload or commit the `node_modules` folder. It is not needed for the website.