
--------------------------------------------------------------
CREATE   View [HRM].vwPersonelRelative

--WITH ENCRYPTION
AS


	
	SELECT r.RelativeID AS Id, p.PersonelID,
	       p.Code                   AS PersonelCode,
	       p2.Title                 AS PersonelName,
	       p2.LastName,
	       r.FirstName,
	       r.LastName AS RLastName,
	       r.BirthCertificateNumber,
	       r.IsSponsored,
	       cfg.GetCLRSaturnDate( r.SponsorshipStartDate,'YYYY/MM/DD',0,0) AS SponsorshipStartDate,
	       cfg.GetCLRSaturnDate( r.SponsorshipEndDate,'YYYY/MM/DD',0,0) AS SponsorshipEndDate,
	       cfg.GetCLRSaturnDate( r.Birthday,'YYYY/MM/DD',0,0) AS Birthday,
	       r.IdentificationCode,
	       CASE r.Relation
	            WHEN 0 THEN 'فرزند'
	            WHEN 1 THEN 'پدر'
	            WHEN 2 THEN 'مادر'
	            WHEN 3 THEN 'برادر'
	            WHEN 4 THEN 'خواهر'
	            WHEN 5 THEN 'ساير'
	            WHEN 6 THEN 'همسر'
	       END                      AS RelationType,
	       CASE  r.Sex
			   WHEN 0 THEN ' مرد'
	           WHEN 1 THEN 'زن'
	       END AS Sex
	FROM   hrm.[Relative]           AS r
	       INNER JOIN HRM.Personel  AS p
	            ON  p.PersonelID = r.PersonelID
	       INNER JOIN CFG.Party     AS p2
	            ON  p2.PartyID = p.PartyID
