
CREATE    PROCEDURE [HRM].[RptPersonelRelativeReview]
(@selPersonel VARCHAR(MAX) = NULL)
--WITH ENCRYPTION
AS

	DECLARE @Format varchar(10),@dateType INT, 
	        @Culture varchar(25),
		    @CultureNo tinyint
	
	SET @Format=cfg.GetCurrentUserDateFormat()
	SET @DateType=cfg.GetCurrentUserDateType()

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	
	SELECT r.RelativeID AS Id, p.PersonelID,
	       p.Code                   AS PersonelCode,
		   case when @CultureNo = 1 then p2.Title
	            when @CultureNo = 2 then p2.Title2
	       end as PersonelName,
		   case when @CultureNo = 1 then p2.LastName
	            when @CultureNo = 2 then p2.LastName2
	       end as LastName,
	       r.FirstName,
	       r.LastName AS RLastName,
	       r.BirthCertificateNumber,
	       cfg.GetCLRSaturnDate( r.SponsorshipStartDate,@Format,0,@dateType) AS SponsorshipStartDate,
	       cfg.GetCLRSaturnDate( r.SponsorshipEndDate,@Format,0,@dateType) AS SponsorshipEndDate,
	       cfg.GetCLRSaturnDate( r.Birthday,@Format,0,@dateType) AS Birthday,
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
		   CASE
		       WHEN r.Birthday IS NULL THEN NULL
		       ELSE DATEDIFF(YEAR, r.Birthday, GETDATE())
		            - CASE
		                  WHEN DATEADD(YEAR, DATEDIFF(YEAR, r.Birthday, GETDATE()), r.Birthday) > GETDATE()
		                      THEN 1
		                  ELSE 0
		              END
		   END AS Age
	FROM   hrm.[Relative]           AS r
	       INNER JOIN HRM.Personel  AS p
	            ON  p.PersonelID = r.PersonelID
	       INNER JOIN CFG.Party     AS p2
	            ON  p2.PartyID = p.PartyID
	WHERE  (
	           @selPersonel IS NULL
	           OR p.PersonelID IN (SELECT VALUE
	                               FROM   cfg.R_FnCommaStr2Table(@selPersonel) AS 
	                                      rfcst)
	       )

