



CREATE VIEW  [HRM].[VwPersonelExperience]

--with encryption
AS 
		

	
SELECT e.ExperienceID              AS Id,
       p.PersonelID,
       p.Code                      AS PersonelCode,
       p2.Title                    AS PersonelName,
       p2.LastName,
       e.CompanyName,
        wp.Title AS Position,
       cfg.GetCLRSaturnDate(e.StartDate, 'YYYY/MM/DD', 0, 0) AS StartDate,
       cfg.GetCLRSaturnDate(e.EndDate, 'YYYY/MM/DD', 0, 0) AS EndDate
FROM   hrm.Experience              AS e
       INNER JOIN HRM.Personel     AS p
            ON  p.PersonelID = e.PersonelID
       INNER JOIN CFG.Party        AS p2
            ON  p2.PartyID = p.PartyID
       LEFT JOIN HRM.EndReason     AS er
            ON  er.EndReasonID = e.EndReasonID
       LEFT JOIN HRM.WorkPosition  AS wp
            ON  wp.WorkPositionID = e.WorkPositionID  



