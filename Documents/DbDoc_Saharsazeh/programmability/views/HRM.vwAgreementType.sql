
CREATE   VIEW HRM.vwAgreementType
AS 

SELECT at.AgreementTypeID,
       at.AgreementTypeFormID,
       at.Title,
       at.Code,
       at.PrePersonelStatusID,
       at.NeedConfirmation,
       cast(CASE 
            WHEN ps.StatusType = 5 AND EXISTS
                 (
                     SELECT 1
                     FROM   hrm.AgreementTypePrePersonelStatus AS atpps
                            INNER JOIN HRM.PersonelStatus AS ps2
                                 ON  ps2.PersonelStatusID = atpps.PersonelStatusID
                     WHERE  ps2.StatusType IN (1,3, 100)
                     AND atpps.AgreementTypeID=at.AgreementTypeID
                 ) THEN 1
            ELSE 0
       END      AS BIT)                       AS IsStart,
       cast(CASE 
            WHEN ps.StatusType IN (3, 1,0) 
            AND exists
            (
                     SELECT 1
                     FROM   hrm.AgreementTypePrePersonelStatus AS atpps
                            INNER JOIN HRM.PersonelStatus AS ps2
                                 ON  ps2.PersonelStatusID = atpps.PersonelStatusID
                     WHERE  ps2.StatusType Not IN (3, 1,0)
                     AND atpps.AgreementTypeID=at.AgreementTypeID
             )
            THEN 1
            ELSE 0
       END   AS BIT)                          AS isEnd
FROM   hrm.AgreementType              AS at
       INNER JOIN HRM.PersonelStatus  AS ps
            ON  ps.PersonelStatusID = at.PrePersonelStatusID
