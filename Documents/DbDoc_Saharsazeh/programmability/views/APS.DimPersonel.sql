
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/22/2018 8:23:22 AM
 ************************************************************/

CREATE VIEW [APS].[DimPersonel]
AS 

SELECT p.PersonelID,
P.Code,
       p2.Title + ' ' + p2.LastName  AS Title,
       DATEDIFF(y, p.Birthday, GETDATE()) AS Age,
       CASE 
            WHEN sex = 1 THEN 'مرد'
            ELSE 'زن'
       END                           AS Sex
FROM   Hrm.Personel                  AS p
       INNER JOIN CFG.Party          AS p2
            ON  p2.PartyID = p.PartyID
