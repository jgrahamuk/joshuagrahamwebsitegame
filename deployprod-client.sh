# Deploy the frontend to the production server
rsync -avz --delete \
  --exclude 'supabase/' \
  --exclude 'CLAUDE.md' \
  --exclude 'LICENSE' \
  --exclude 'nginx.conf.sample' \
  --exclude 'README.md' \
  --exclude 'readme.md' \
  --exclude 'server.py' \
  --exclude 'deployprod.sh' \
  --exclude 'js/config.js' \
  --exclude '.git/' \
  --exclude '.gitignore' \
  --exclude 'maps/' \
  -e "ssh -i ~/.ssh/jvm1_key.pem" \
  ./ azureuser@maap.to:/var/www/maapto/
