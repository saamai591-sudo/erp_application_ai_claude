
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 02/05/95 09:51:14 صبح
 ************************************************************/

CREATE VIEW [HRM].[vWLastAgreement]
AS 
 
SELECT *
FROM   (
           SELECT *,
                  ROW_NUMBER() OVER(partition BY personelId ORDER BY a.IssueDate DESC) AS Rno
           FROM   hrm.Agreement AS a
           WHERE  (
                      SELECT c.ConfigValue
                      FROM   cfg.Configuration AS c
                      WHERE  c.ConfigKey = 'AgreementNeedConfirm'
                  ) <> 'true'
                  OR  a.ConfirmDate IS NOT NULL
       )t
WHERE  t.Rno = 1

 

