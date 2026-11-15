------------------------------------- END #64787
------------------------------------- START #65534
CREATE   PROCEDURE [HRM].[RptConfirmation](@ConfirmationIds VARCHAR(MAX))
--WITH ENCRYPTION
AS
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	DECLARE @issueDate      Date,
	        @PersonelId     INT
	
	SELECT @issueDate = c.IssueDate,
	       @PersonelId = c.PersonelID
	FROM   hrm.Confirmation c
	WHERE  c.ConfirmationID = @ConfirmationIds
		
   SELECT *,ROW_NUMBER() OVER(
                PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC
            )         AS Rno into #Agreement
     FROM   HRM.Agreement a
     WHERE  a.PersonelID = @PersonelId
            AND (@NeedConfirm = 0 OR a.ConfirmDate IS NOT null)
             AND a.IssueDate <= @issueDate
	                
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.ParameterID,
	       T.Amount,
	       EmploymentType		   
	INTO     #lastAggreement 
	FROM   (
	           SELECT a.*,
	                  et.Title  AS EmploymentType,
	                  ap.ParameterID,
	                  ap.Amount
	           FROM   #Agreement a
	                  INNER JOIN HRM.AgreementParameter ap
	                       ON  ap.AgreementID = a.AgreementID
	                  INNER JOIN HRM.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                    INNER JOIN pay.Parameter p
	                    ON p.ParameterID = ap.ParameterID
	           WHERE  a.Rno = 1
	           AND p.CategoryID=2
	                  AND ap.ExecuteDate <= @issueDate
	       )        T
	
	SELECT c.*,
	       Lagg.EmploymentType,
	       lagg.benefit,
	       p.Code                        AS PersonelCode,
	       p2.Title + ' ' + p2.LastName  AS PersonelFullName,
	       cfg.GetSaturnDate(c.IssueDate, 0) AS IssueDateString,
	       cfg.GetSaturnDate(c.CloseDate, 0) AS CloseDateString,
	       ct.Title                      AS ConfirmationTypeTitle,
	       cf.Title                      AS ConfirmationFromTitle,
		   p.FatherName,
		   l.Title Location_title,
		   Lagg.ExecuteDate,
		   p2.IdentificationCode,
		   p2.NationalID

	FROM   hrm.Confirmation c
	       INNER JOIN cfg.R_FnCommaStr2Table(@ConfirmationIds) rfcst
	            ON  rfcst.[value] = c.ConfirmationID
	       INNER JOIN HRM.Personel p
	            ON  p.PersonelID = c.PersonelID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN HRM.ConfirmationType ct
	            ON  ct.ConfirmationTypeID = c.ConfirmationTypeID
	       INNER JOIN HRM.ConfirmationForm cf
	            ON  cf.ConfirmationFormID = ct.ConfirmationFormID
				left join cfg.Location l on l.LocationID=p.IssueLocationID
	       LEFT JOIN (
	                SELECT PersonelID,
	                       MAX(EmploymentType) AS EmploymentType,
	                       SUM(Amount) AS benefit,
						   cfg.GetSaturnDate(ExecuteDate,0)  ExecuteDate
	                FROM   #lastAggreement
	                GROUP BY
	                       PersonelID,ExecuteDate
						  
	            )Lagg
	            ON  lagg.PersonelID = p.PersonelID
	WHERE  c.ConfirmationStatus = 2 OR c.ConfirmationStatus = 4
