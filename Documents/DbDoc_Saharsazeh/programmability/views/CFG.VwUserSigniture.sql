
CREATE   VIEW [CFG].[VwUserSigniture]
as
	select u.UserID,pf.Signature,u.Name2 FullName
	from cfg.[user] u
	join cfg.Party p on p.PartyID = u.PartyID
	join hrm.Personel pe on pe.[PartyID] = p.PartyID
	join hrm.PersonelFile pf on pf.PersonelID = pe.PersonelID
