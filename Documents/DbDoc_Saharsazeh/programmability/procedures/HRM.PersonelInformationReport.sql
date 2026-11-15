/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.1.261
 * Time: 7/11/2017 1:55:58 PM
 ************************************************************/

CREATE PROCEDURE [HRM].[PersonelInformationReport]
(@EmploymentTypeID VARCHAR(50)=null)
AS
	DECLARE @Columns           AS NVARCHAR(MAX),
	        @Query             AS NVARCHAR(MAX),
	        @CustomeFields     AS NVARCHAR(MAX),
	        @UserID            INT,
	        @DateType          VARCHAR(10),
	        @DateFormat        VARCHAR(10),
	        @Culture           VARCHAR(10)
	
	
			set @Culture = CFG.GetuserCulture()

	SET  @UserID=cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'



	SELECT @CustomeFields = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(Fieldname)
	               FROM   cfg.EntityCustomeField
	               WHERE  EntityName = 'Personel'
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	IF (@CustomeFields IS NULL)
	    SET @CustomeFields = '[NoCustomeField]' 
	
	
	
	
	SELECT p.PersonelID,
	       p.Code,
	       p2.Title,
	       p2.LastName
	INTO   #T
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   hrm.Agreement AS a
	       )T
	       INNER JOIN hrm.Personel AS p
	            ON  p.PersonelID = T.PersonelID
	       INNER JOIN CFG.Party AS p2
	            ON  p2.PartyID = p.PartyID
	WHERE  T.Rno = 1
	      
	       AND (
	               @EmploymentTypeID IS NULL
	               OR T.EmploymentTypeID IN (SELECT VALUE
	                                         FROM   cfg.R_FnCommaStr2Table(@EmploymentTypeID) AS rfcst)
	           )
	
	
	SET @Query = 
	    '

select 
 *
from #T

LEFT JOIN 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType + 
	    ''') else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
LEFT JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''Personel''
)x
pivot 
(
	 max(Value)
	for Fieldname IN (' + @CustomeFields + ')
)  piv	
)CustomEntities on CustomEntities.EntityID = #T.PersonelID
'
	
	
	EXEC (@Query)
