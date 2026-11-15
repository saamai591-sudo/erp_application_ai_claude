


CREATE VIEW [HRM].[VwPersonelAccount]

--with encryption
AS 

SELECT 
	pa.PersonelAccountID AS Id,
	p.PersonelID,
	       p.Code                       AS PersonelCode,
	       p2.Title                     AS PersonelName,
	       p2.LastName,
	       bat.Title                    AS BankAccountTypeTitle,
	       bb.Title                     AS BankBranchTitle,
	       pt.Title                     AS PaymentTopicTitle,
	       b.Title                      AS BankTitle,pa.AccountNumber
	      , 
	       
	       cfg.GetCLRSaturnDate( pa.[Date],'YYYY/MM/DD',0,0) AS [Date]
	      
	FROM   hrm.PersonelAccount          AS pa
	       INNER JOIN HRM.Personel      AS p
	            ON  p.PersonelID = pa.PersonelID
	       INNER JOIN CFG.Party         AS p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN CFG.BankAccountType AS bat
	            ON  bat.BankAccountTypeID = pa.BankAccountTypeID
	       INNER JOIN CFG.BankBranch    AS bb
	            ON  bb.BankBranchID = pa.BankBranchID
	       INNER JOIN HRM.PaymentTopic  AS pt
	            ON  pt.PaymentTopicID = pa.PaymentTopicID
	       INNER JOIN CFG.Bank          AS b
	            ON  b.BankID = bb.BankID
	


