MACHIKA RECEIPT MAKER - sabon website (HTML, CSS da JS a raba)

YADDA ZAKA SAKA SHI A NETLIFY
1. Cire zip din (Extract / Unzip) har ka ga folder "machika-receipt-maker".
2. Ka shiga Netlify > site dinka > Deploys, ka ja folder din "machika-receipt-maker" (dukkansa) ka sauke shi
   a wurin "Drag and drop". Ka saka dukkan folder din, ba index.html kadai ba, domin css/ da js/ suna ciki.
3. Fayil din "_redirects" yana cikin folder. Shi ke sa /login, /dashboard, /create-receipt, da sauransu
   su yi aiki idan aka sake load shafin. Kada ka goge shi.

ABUBUWAN DA SUKE CIKIN FOLDER
index.html        tsarin shafuka (landing, login, app)
css/base.css      launuka, rubutu, maballai, fom
css/layout.css    sidebar, topbar, tab bar na waya
css/public.css    landing da login
css/app.css       dashboard, create receipt, receipts, profile, account, admin
css/receipt.css   kamannin receipt din da ake saukewa (an barshi yadda yake)
js/               dukkan aikin website; js/config.js yana dauke da Supabase URL, key da admin email
favicon.svg, _redirects

KA GWADA BAYAN SAKAWA
An gwada duk ayyukan a nan da Supabase na jabu (stub), don haka bayan ka saka shi a Netlify ka gwada:
login, Create receipt, Save receipt, Download PNG, bude receipt a Receipts, goge receipt, Telegram, Super admin.