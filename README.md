# 🇨🇳 WHY WE FKING LEFT CHINA INTERNET / 我们为什么滚出中国互联网  
![Rage](https://i.imgur.com/rage.png)  

🚀 背景故事 / WTF Happened?  

我们是一个100%合规、有备案、乖乖交税的startup，直到遇上了工信部 (MIIT) 和网信办 (CAC) 的“特色监管” (Chinese-style regulation)。  
经过无数次SB整改通知、选择性执法 (selective enforcement) 和官僚主义刁难 (bullshit bureaucracy)，我们决定：  

🔥 去你妈的！不玩了！ / FK THIS SHIT, WE'RE OUT! 🔥  

这个repo将记录中国互联网的魔幻现实 (Kafkaesque nightmare)，并教你怎么逃离这个粪坑 (escape this hellhole)。  

💢 我们的遭遇 / Our Horror Story  
1. 备案？备你妈！ / "Licensing"? Go Fk Yourself!  

- 我们营业执照、公章、对公账户全齐 (all fking licenses)，严格按照流程备案。  
- 结果？刚备完就被标记“诈骗风险” (flagged as "fraud")，理由？“未接入支付宝/微信支付” (no Alipay/WeChat Pay)。  
- 🤡 搞笑点：我们是个开源文档站 (open-source docs)，根本不需要支付接口！  
2. 选择性执法，专杀老实人 / Selective Enforcement, Only Fk the Honest  

- 盗版电影站 (piracy sites)、赌博平台 (gambling)、杀猪盘 (scams) 活得好好的，甚至能在百度竞价排名 (Baidu ads)。  
- 我们这种正经项目 (legit project)，反而被重点关照 (special treatment)，三天两头接到“整改通知” (compliance notices)。  
- 经典案例：某知名盗版站 ([截图](https://i.imgur.com/xxx)) 至今存活，而我们因为“页面加载速度过快” (loading too fast) 被怀疑是“境外代理” (foreign proxy)。  
3. 香港企业？特殊照顾！ / Hong Kong Company? Extra BS!  

- 我们注册在大湾区 (Greater Bay Area)，政策上号称“鼓励港澳创业” (pro-HK/MO policy)。  
- 实际执行？“港澳同胞，罚单加倍” (extra fines for HKers)!  
- 同样业务，内地公司没事，我们被要求“补充材料” (request more docs) 十几次，最后直接“不予通过” (rejected)。  
4. 终极笑话：AI审核 / "AI Auditing" = Clown Show  

- 他们的“智能风控” (AI system) 能误杀99%的正经网站，但永远抓不到真正的违规内容。  
- 我们的网站因为“背景颜色太鲜艳” (background too colorful) 被警告可能“诱导用户” (trick users)，而某裸聊广告 (porn ads) 却能在各大平台存活。  
🌍 我们的解决方案 / Our Solution: GTFO of China  
1. 技术架构：让监管摸不到 / Tech Stack: Untouchable  

- 前端 (Frontend): Cloudflare Pages + Workers（无服务器，国内无法封IP / no server, no block）  
- 后端 (Backend): Supabase（海外数据库，数据不出境？不存在的！ / data outside China）  
- 域名 (Domain): Namecheap + Cloudflare DNS（国内想Hold？做梦！ / no Chinese registrar）  
2. 访问策略：爱来不来 / Access Policy: GFW Yourself  

- 屏蔽所有中国IP (Block all CN IPs)（Nginx直接Ban掉ASN）  
- 检测到中文UA (Chinese User-Agent)? 返回 418 I'm a teapot（经典嘲讽 / classic troll）  
- 想访问？自己翻墙！ (Want access? Use a VPN.)  
3. 支付方案：去你妈的支付宝 / Payments: No Alipay/WeChat  

- Stripe（全球支付，不伺候国内KYC / global payments）  
- 加密货币 (Crypto)（BTC/ETH/USDT，彻底去中心化 / decentralized）  
- 国内用户想付钱？先学会用VPN！ (Chinese users? Figure it out.)  
📢 致工信部的一封信 / Open Letter to MIIT  
亲爱的工信部傻逼们 (Dear MIIT Clowns)：  

感谢你们的“严格监管” (strict supervision)，让我们意识到——  

在中国，守法企业=傻逼，关系户=爷！  
(In China, compliant = loser, guanxi = king.)  

我们现在要去真正自由的市场 (actual free markets) 竞争了。祝你们早日被盗版站和赌博网站 (piracy/gambling sites) 搞垮！  

PS：等你们终于封掉所有裸聊广告 (porn ads) 的时候，记得给我们发个邮件，我们可能会考虑回来（笑）。  

🚨 免责声明 / Disclaimer  

- 本站已完全脱离中国法律管辖 (outside China's jurisdiction)，中国大陆用户访问即代表自愿突破国家防火墙 (bypass GFW at your own risk)。  
- 本仓库内容仅作技术讨论 (technical discussion)，不代表任何政治立场（求生欲拉满 / survival mode ON）。  
🔥 如果这篇README被删了，欢迎Fork & 镜像！ / IF DELETED, FORK IT!  

👉 让全球看看什么叫“中国特色监管”！ / SHOW THE WORLD "CHINESE-STYLE REGULATION"!  

📌 如何贡献？ / How to Contribute?  

Fork本项目 / Fork this repo，让更多人看到！  

提交你的“中国监管魔幻经历” / Share your horror stories，我们整理成《中国开发者生存报告》。  

Star & Share，让GitHub Trending也感受下中国式监管的威力！  认同我们的理念，想要支持一个年轻团队的梦想， 我们将无比感激。[你的每一份支持，无论大小，都是对我们最大的鼓励。](https://www.jorkai.cn/donation)

