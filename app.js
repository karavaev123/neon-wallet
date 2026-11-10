const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
const $=id=>document.getElementById(id);
let currency="RUB",kind="deposit",me=null;
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function money(n){return Number(n||0).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}
async function api(url,opts={}){const initData=tg?.initData||"";const r=await fetch(url,{...opts,headers:{"Content-Type":"application/json","X-Telegram-init-data":initData,...opts.headers}});const d=await r.json();if(!r.ok)throw Error(d.error||"Ошибка");return d}
function render(data){me=data.user;$("name").textContent=me.name;$("avatar").textContent=(me.name||"N").trim()[0].toUpperCase();$("rub").innerHTML=money(me.rub)+' <small>₽</small>';$("usdt").innerHTML=money(me.usdt)+' <small>USDT</small>';
const list=$("requests");if(!data.requests.length){list.className="empty";list.textContent="Здесь появятся ваши заявки";return}
list.className="";list.innerHTML=data.requests.map(x=>`<div class="request"><div>${({deposit:"Пополнение",withdraw:"Вывод",cash:"Снятие наличных"})[x.kind]}<small>${new Date(x.created_at+"Z").toLocaleString("ru-RU")}</small></div><span class="status">ОЖИДАЕТ</span></div>`).join("")}
async function load(){if(!tg?.initData){$("name").textContent="Откройте в Telegram";toast("Запустите приложение через Telegram-бота");return}try{render(await api("/api/me"))}catch(e){$("name").textContent="Ошибка авторизации";toast(e.message)}}
document.querySelectorAll("[data-kind]").forEach(b=>b.addEventListener("click",()=>{kind=b.dataset.kind;currency="RUB";document.querySelectorAll("[data-currency]").forEach(x=>x.classList.toggle("selected",x.dataset.currency===currency));$("modalTitle").textContent=({deposit:"Пополнение",withdraw:"Вывод",cash:"Снять наличные"})[kind];$("modal").classList.add("open");$("amount").value="";if(kind==="cash")toast("Заявка на наличные (демо)")}));
$("close").onclick=()=>$("modal").classList.remove("open");$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.remove("open")});
document.querySelectorAll("[data-currency]").forEach(b=>b.onclick=()=>{currency=b.dataset.currency;document.querySelectorAll("[data-currency]").forEach(x=>x.classList.toggle("selected",x===b))});
$("submit").onclick=async()=>{const amount=Number($("amount").value.replace(",","."));if(!amount||amount<=0){toast("Введите корректную сумму");return}try{const d=await api("/api/request",{method:"POST",body:JSON.stringify({kind,amount,currency})});$("modal").classList.remove("open");toast(d.message);await load()}catch(e){toast(e.message)}};
load();