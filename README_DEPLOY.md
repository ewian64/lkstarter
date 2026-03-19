# Deploy StarterSar cabinet

## GitHub
1. Create empty GitHub repository.
2. Upload contents of this folder.
3. Do NOT upload `.env`.

## Render deploy
1. Sign in to Render.
2. New + -> Web Service.
3. Connect GitHub repo.
4. Render will detect `render.yaml` automatically.
5. Fill environment variables in Render dashboard.
6. Deploy.

## Domain
After deploy, add your domain in Render -> Settings -> Custom Domains and point DNS to Render target.
