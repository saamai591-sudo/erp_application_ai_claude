





/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/03/95 02:47:57 عصر
 ************************************************************/

CREATE VIEW [HRM].[ChangePersonelStatus]

AS

SELECT a.PersonelID,
       a.ExecuteDate                  AS ChangeDate,
       ps.StatusType                  AS STATUS,
       CASE (
                SELECT c.ConfigValue
                FROM   cfg.Configuration AS c
                WHERE  c.ConfigKey = 'AgreementNeedConfirm'
            )
            WHEN 'true' THEN a.ConfirmDate
            ELSE a.IssueDate
       END                            AS IssueDate,
       a.AgreementID
FROM   hrm.Agreement                  AS a
       INNER JOIN HRM.AgreementType   AS at
            ON  at.AgreementTypeID = a.AgreementTypeID
       INNER JOIN HRM.PersonelStatus  AS ps
            ON  ps.PersonelStatusID = at.PrePersonelStatusID
       INNER JOIN hrm.CalendarMonth   AS cm
            ON  a.ExecuteDate BETWEEN cm.StartDate AND cm.EndDate
       INNER JOIN hrm.CalendarMonth   AS cm2
            ON  a.IssueDate BETWEEN cm2.StartDate AND cm2.EndDate
WHERE  (
           (
               SELECT c.ConfigValue
               FROM   cfg.Configuration AS c
               WHERE  c.ConfigKey = 'AgreementNeedConfirm'
           )
           <> 'true'
           OR a.ConfirmDate IS NOT NULL
       )
       AND (
               (cm.StartDate >= cm2.StartDate)
               OR at.IsStartType=1
           )


