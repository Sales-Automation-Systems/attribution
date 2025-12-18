-- Seed personal email domains
-- These domains will be excluded from soft matching

INSERT INTO personal_email_domain (domain) VALUES
  -- Major providers
  ('gmail.com'),
  ('yahoo.com'),
  ('hotmail.com'),
  ('outlook.com'),
  ('live.com'),
  ('aol.com'),
  ('icloud.com'),
  ('me.com'),
  ('mac.com'),
  ('msn.com'),
  
  -- Privacy-focused
  ('protonmail.com'),
  ('proton.me'),
  ('tutanota.com'),
  ('pm.me'),
  ('hey.com'),
  ('fastmail.com'),
  ('mailbox.org'),
  ('runbox.com'),
  ('posteo.de'),
  ('posteo.net'),
  
  -- Other international
  ('zoho.com'),
  ('mail.com'),
  ('gmx.com'),
  ('gmx.net'),
  ('yandex.com'),
  ('yandex.ru'),
  ('inbox.com'),
  
  -- ISP email
  ('comcast.net'),
  ('verizon.net'),
  ('att.net'),
  ('sbcglobal.net'),
  ('cox.net'),
  ('earthlink.net'),
  ('charter.net'),
  ('optonline.net'),
  ('frontier.com'),
  ('bellsouth.net'),
  ('roadrunner.com'),
  ('centurylink.net'),
  ('windstream.net'),
  
  -- China
  ('qq.com'),
  ('163.com'),
  ('126.com'),
  ('sina.com'),
  ('aliyun.com'),
  ('foxmail.com'),
  
  -- Korea
  ('naver.com'),
  ('hanmail.net'),
  ('daum.net'),
  
  -- Japan
  ('yahoo.co.jp'),
  ('docomo.ne.jp'),
  ('ezweb.ne.jp'),
  ('softbank.ne.jp'),
  
  -- Germany
  ('web.de'),
  ('gmx.de'),
  ('t-online.de'),
  ('freenet.de'),
  ('arcor.de'),
  
  -- France
  ('orange.fr'),
  ('free.fr'),
  ('laposte.net'),
  ('sfr.fr'),
  ('wanadoo.fr'),
  
  -- Italy
  ('libero.it'),
  ('virgilio.it'),
  ('alice.it'),
  ('tin.it'),
  ('tiscali.it'),
  
  -- Spain
  ('telefonica.net'),
  ('terra.es'),
  
  -- UK
  ('btinternet.com'),
  ('virginmedia.com'),
  ('sky.com'),
  ('talktalk.net'),
  ('ntlworld.com'),
  
  -- Australia
  ('bigpond.com'),
  ('optusnet.com.au'),
  ('iinet.net.au'),
  
  -- Canada
  ('rogers.com'),
  ('shaw.ca'),
  ('bell.net'),
  ('telus.net'),
  
  -- Brazil
  ('uol.com.br'),
  ('bol.com.br'),
  ('terra.com.br'),
  ('globo.com'),
  
  -- India
  ('rediffmail.com'),
  
  -- Russia
  ('mail.ru'),
  ('rambler.ru'),
  
  -- Other
  ('email.com'),
  ('usa.com'),
  ('myself.com'),
  ('consultant.com'),
  ('workmail.com'),
  ('writeme.com'),
  ('hushmail.com'),
  ('mailfence.com'),
  ('disroot.org'),
  ('riseup.net')
ON CONFLICT (domain) DO NOTHING;


