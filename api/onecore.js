export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
 const key=process.env.OPENAI_API_KEY;
 if(!key) return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 const {task,capability,module,sensitive}=req.body||{};
 if(!task||typeof task!=="string") return res.status(400).json({error:"Task is required"});
 try{
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5-mini",instructions:"You are Nexora OneCore AI. Give concise business workflow assistance. Never claim an external action happened unless evidenced. Sensitive financial, legal, medical, destructive, purchasing, publishing or account-changing actions require human approval.",input:"Capability: "+capability+"\nModule: "+module+"\nApproval required: "+Boolean(sensitive)+"\nTask: "+task})});
  const data=await r.json();
  if(!r.ok) return res.status(r.status).json({error:(data.error&&data.error.message)||"AI provider request failed"});
  let output=data.output_text||"";
  if(!output&&Array.isArray(data.output)) output=data.output.flatMap(x=>x.content||[]).map(x=>x.text||"").join("\n").trim();
  return res.status(200).json({output:output||"No text returned."});
 }catch(e){return res.status(500).json({error:"OneCore AI backend error"});}
}