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

# Push the database schema to the test database
npx supabase db push --include-seed --db-url 'postgres://postgres.your-tenant-id:4aed37f97fa5ce53a9b2ac386577d659@maap.to:6543/postgres' --debug

scp -i ~/.ssh/jvm1_key.pem -r supabase/functions/* azureuser@maap.to:~/supabase-project/volumes/functions/

ssh -i ~/.ssh/jvm1_key.pem azureuser@maap.to "cd ~/supabase-project; sudo docker compose restart functions --no-deps"