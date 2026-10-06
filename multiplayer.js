/* Reusable multiplayer transport for browser games.
 * No game-specific roles, votes, words, timers, UI, or scoring.
 */
(()=>{"use strict";
const D={supabaseUrl:"https://dkwmkvruzebnqlmvwzhy.supabase.co",supabaseKey:"sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P",channelPrefix:"multiplayer-room:",publicRoomsTable:"public_rooms",maxPlayers:20,connectTimeout:15000,roomCodeLength:8};
const cleanName=v=>String(v||"").trim().replace(/\s+/g," ").slice(0,24);
function randomCode(n=8){const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",b=new Uint8Array(n);crypto.getRandomValues(b);return [...b].map(v=>a[v%a.length]).join("")}
function parseRoom(v){let r=String(v||"").trim();try{const u=new URL(r),m=u.hash.match(/room=([^&]+)/i);if(m)r=decodeURIComponent(m[1])}catch{}const m=r.match(/room=([^&#]+)/i);if(m)r=decodeURIComponent(m[1]);r=r.replace(/^room=/i,"").trim();return /^[a-z0-9]{6,16}$/i.test(r)?r.toUpperCase():""}
function create(opts={}){const c={...D,...opts};if(!window.supabase?.createClient)throw Error("Supabase JS is not loaded.");const db=window.supabase.createClient(c.supabaseUrl,c.supabaseKey),L=new Map(),s={id:"",room:"",hostId:"",host:false,name:"",connected:false,channel:null,players:new Map(),settings:{},public:false,heartbeat:null};
const on=(t,f)=>(L.has(t)||L.set(t,[]),L.get(t).push(f),()=>{const a=L.get(t),i=a.indexOf(f);if(i>=0)a.splice(i,1)}),emit=(t,v)=>(L.get(t)||[]).forEach(f=>{try{f(v)}catch(e){console.warn("[Multiplayer]",e)}}),players=()=>[...s.players.values()].filter(p=>p.connected!==false);
const invite=()=>s.room?((window.location?.href||"").split("#")[0]+"#room="+encodeURIComponent(s.room)):"";
async function open(){if(s.channel)try{await db.removeChannel(s.channel)}catch{}const ch=db.channel(c.channelPrefix+s.hostId.toLowerCase(),{config:{private:true,broadcast:{self:false,ack:true}}});ch.on("broadcast",{event:"game"},({payload})=>handle(payload));await new Promise((ok,no)=>{let done=false,tm=setTimeout(()=>{if(!done){done=true;no(Error("Room server connection timed out."))}},c.connectTimeout);ch.subscribe((st,err)=>{if(st==="SUBSCRIBED"&&!done){done=true;clearTimeout(tm);ok()}else if((st==="CHANNEL_ERROR"||st==="TIMED_OUT")&&!done){done=true;clearTimeout(tm);no(Error(err?.message||st))}else if(st==="CLOSED"&&done){s.connected=false;emit("disconnect")}})});s.channel=ch;s.connected=true}
function send(x){if(!s.channel)return false;try{const p=s.channel.send({type:"broadcast",event:"game",payload:{...x,from:s.id}});p?.catch?.(e=>console.warn("[Multiplayer] send",e));return true}catch(e){console.warn("[Multiplayer] send",e);return false}}
const sendTo=(id,x)=>send({...x,to:id}),broadcast=x=>send({...x,to:null});
function handle(m){if(!m?.type||m.to&&m.to!==s.id)return;const from=m.from;if(s.host){if(m.type==="hello"){if(s.players.size>=c.maxPlayers)return sendTo(from,{type:"full"});const p={id:from,name:cleanName(m.name)||"Player",isHost:false,ready:false,connected:true};s.players.set(from,p);sendTo(from,{type:"accepted",room:s.room,hostId:s.hostId,settings:s.settings});emit("player-join",p);emit("players",players());return}if(m.type==="leave"){const p=s.players.get(from);if(p){s.players.delete(from);emit("player-leave",p);emit("players",players())}return}const p=s.players.get(from);if(p)emit("player-message",{player:p,message:m});return}if(m.type==="accepted"){s.room=m.room||s.room;s.hostId=m.hostId||s.hostId;s.settings={...s.settings,...(m.settings||{})};emit("accepted",m);return}if(m.type==="lobby"){s.settings={...s.settings,...(m.settings||{})};s.players.clear();(m.players||[]).forEach(p=>s.players.set(p.id,p));emit("players",players());emit("lobby",m);return}if(m.type==="full"){emit("full");return}if(m.type==="busy"){emit("busy");return}if(m.type==="host-left"){emit("host-left");return}emit("message",m)}
async function host({name,settings={},publicRoom=false}={}){s.room=randomCode(c.roomCodeLength);s.hostId=c.channelPrefix.replace(/:$/,"")+"-"+s.room.toLowerCase();s.id=s.hostId;s.host=true;s.name=cleanName(name);if(!s.name)throw Error("A player name is required.");s.settings={...settings};s.public=!!publicRoom;await open();s.players.set(s.id,{id:s.id,name:s.name,isHost:true,ready:true,connected:true});if(s.public)startHeartbeat();emit("connected",snapshot());emit("players",players());return snapshot()}
async function join({room,name,hostId}={}){const code=parseRoom(room);s.room=code;s.hostId=String(hostId||c.channelPrefix.replace(/:$/,"")+"-"+code.toLowerCase());s.id="guest-"+randomCode(8).toLowerCase();s.host=false;s.name=cleanName(name);if(!code||!s.name)throw Error("A valid room and player name are required.");await open();sendTo(s.hostId,{type:"hello",name:s.name});emit("connected",snapshot());return snapshot()}
function startHeartbeat(){stopHeartbeat();const tick=async()=>{if(!s.public||!s.host)return;const p={host_id:s.hostId,room_code:s.room,host_name:s.name,player_count:players().length,max_players:Number(s.settings.maxPlayers||s.settings.players||c.maxPlayers),category:s.settings.category||"default",game_time:Number(s.settings.gameTime||s.settings.time||0),expires_at:new Date(Date.now()+15000).toISOString()};const{error}=await db.from(c.publicRoomsTable).upsert(p,{onConflict:"host_id"});if(error)console.warn("[Multiplayer] public heartbeat",error)};tick();s.heartbeat=setInterval(tick,5000)}
function stopHeartbeat(){if(s.heartbeat){clearInterval(s.heartbeat);s.heartbeat=null}}
async function listPublic(){const{data,error}=await db.from(c.publicRoomsTable).select("host_id,room_code,host_name,player_count,max_players,category,game_time,expires_at,created_at").gt("expires_at",new Date().toISOString()).lt("player_count",c.maxPlayers+1).order("created_at",{ascending:true});if(error)throw error;return(data||[]).filter(r=>r?.host_id&&r?.room_code&&new Date(r.expires_at).getTime()>Date.now())}
async function leave(){try{if(s.host){players().forEach(p=>{if(p.id!==s.id)sendTo(p.id,{type:"host-left"})})}else if(s.hostId)sendTo(s.hostId,{type:"leave"});if(s.public){stopHeartbeat();await db.from(c.publicRoomsTable).delete().eq("host_id",s.hostId)}}finally{stopHeartbeat();try{if(s.channel)await db.removeChannel(s.channel)}catch{}s.channel=null;s.connected=false;s.players.clear();emit("disconnected")}}
const lobbySync=()=>s.host&&broadcast({type:"lobby",settings:s.settings,players:players()});
const snapshot=()=>({id:s.id,room:s.room,hostId:s.hostId,isHost:s.host,name:s.name,connected:s.connected,publicRoom:s.public,players:players(),settings:{...s.settings},invite:invite()});
return{
  client:db,config:c,on,host,join,leave,sendTo,broadcast,lobbySync,listPublic,
  playerList:players,snapshot,
  get state(){return snapshot()},
  get connected(){return s.connected},
  get isHost(){return s.host},
  get id(){return s.id},
  get room(){return s.room},
  get hostId(){return s.hostId},
  get invite(){return invite()}
};
}
function api(){return{create,cleanName,parseRoom,randomCode}}
window.LoginMultiplayer=api();
})();