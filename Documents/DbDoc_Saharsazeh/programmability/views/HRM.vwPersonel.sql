
CREATE   VIEW [HRM].vwPersonel
--with encryption
AS 

with cte as (
SELECT *
FROM   cfg.VwEnums AS le
WHERE  le.Enum IN ('Sexes'))

SELECT p.CompanyID ,
		p.PersonelID,
	   p.Code PersonelCode,
	   p2.Title                   FirstName,
	   p2.Title2                  FirstName2,
	   l.Title                    BirthLocation,
	   l.Title2                   BirthLocation2,
	   p.BirthLocationID,
	   p.IssueLocationID,
	   l2.Title                   IssueLocation,
	   l2.Title2                  IssueLocation2,
	   p2.LastName,
	   p2.LastName2,
	   p2.Title + ' '+p2.LastName FullName1,
	   p2.Title2 + ' '+p2.LastName2 FullName2,
	   p2.IdentificationCode,
	   p.InsuranceNumber,
	   p.BirthCertificateNumber,
	   ve.Value as Sex,
	   p.Birthday,
		(
	 SELECT COUNT(*)
	 FROM   hrm.[Relative] AS r
	 WHERE  r.IsSponsored = 1
			AND r.PersonelID = p.PersonelID
 )                       AS RelationCount,
		(
		   SELECT COUNT(*)
		   FROM   hrm.[Relative] AS r
		   WHERE  r.Relation = 0
				  AND r.PersonelID = p.PersonelID
	   )                       AS ChildCount
FROM   hrm.Personel            AS p
	   JOIN cfg.Party          AS p2
			ON  p2.PartyID = p.PartyID
	   left JOIN cfg.Location  AS l
			ON  l.LocationID = p.BirthLocationID
	   left JOIN cfg.Location  AS l2
			ON  p.IssueLocationID = l2.LocationID
	   left JOIN cte      AS ve
			ON  p.Sex = ve.KeyValue
