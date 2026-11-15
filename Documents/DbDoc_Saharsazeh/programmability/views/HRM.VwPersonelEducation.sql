



CREATE VIEW [HRM].[VwPersonelEducation]

--with encryption
AS

	
	
SELECT e.EducationID                  AS Id,
       p.PersonelID,
       p.Code                         AS PersonelCode,
       p2.Title                       AS PersonelName,
       p2.LastName,
       i.Title AS Institute,
	       sf.Title AS Field,
       e.Average,
      ct.Title AS CertificateType,
       cfg.GetCLRSaturnDate(e.StartDate, 'YYYY/MM/DD', 0, 0) AS StartDate,
       cfg.GetCLRSaturnDate(e.EndDate, 'YYYY/MM/DD', 0, 0) AS EndDate,
        sd.Title AS DegreeType
FROM   hrm.Education                  AS e
       INNER JOIN HRM.Personel        AS p
            ON  p.PersonelID = e.PersonelID
       INNER JOIN CFG.Party           AS p2
            ON  p2.PartyID = p.PartyID
       LEFT JOIN HRM.Institue         AS i
            ON  i.InstitueID = e.InstituteID
       LEFT JOIN HRM.StudyDegree      AS sd
            ON  sd.StudyDegreeID = e.StudyDegreeID
       LEFT JOIN HRM.StudyField       AS sf
            ON  sf.StudyFieldID = e.StudyFieldID
       LEFT JOIN HRM.CertificateType  AS ct
            ON  ct.CertificateTypeID = e.CertificateTypeID 




