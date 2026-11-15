
------------------------------------- END #7166
CREATE    PROCEDURE [HRM].GetPersonelList
(
	@PageNumber     INT,
	@RowspPage      INT,
	@Sort           NVARCHAR(MAX) = NULL,
	@Filter         NVARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Man VARCHAR(10),
			@Woman VARCHAR(10),
			@Single VARCHAR(10),
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers NVARCHAR(MAX),				
			@Married VARCHAR(10),
			@Moeil VARCHAR(10),
			@Culture VARCHAR(10),
			@CultureNo VARCHAR(10),
			@UnauthorizedUsers NVARCHAR(MAX);
			
			
SELECT vpsid.PersonelID,CASE WHEN vpsid.[STATUS] = 3 then 0 else 1 END as IsActive 
into #vwPersonelStatusInDate
FROM hrm.vwPersonelStatusInDate AS vpsid    
WHERE vpsid.[DATE] = CAST (GETDATE() as DATE)
			
	set @Culture = CFG.GetuserCulture()	
	SET  @UserID=cfg.GetuserID()
	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture




	select @Married = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'MarriageStatus'
	and L.Item = 'Married'
	and LV.Culture = @Culture
	
	select @Moeil = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'MarriageStatus'
	and L.Item = 'Moeil'
	and LV.Culture = @Culture	
			
	select @Single = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'MarriageStatus'
	and L.Item = 'Single'
	and LV.Culture = @Culture
			
	select @Man = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'Sex'
	and L.Item = 'Man'
	and LV.Culture = @Culture
	
	select @Woman = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'Sex'
	and L.Item = 'Woman'
	and LV.Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture   WHEN 'fa' THEN 0	
									WHEN 'en' THEN 1
									WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
		   
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'

	SELECT @ViewRelatedToUser = UserID
	FROM   cfg.vwOperationLevelAccess
	WHERE ( EntityName  = 'Personel' OR EntityName  = 'PrivateFile')
		   AND AccessKey = 'ViewRelatedToUser'
		   AND UserID         = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
		   @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  ( EntityName  = 'Personel' OR EntityName  = 'PrivateFile')
		   AND AccessKey = 'ViewRelatedToOthers'
		   AND UserID  = @UserID

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
		'
		WITH Query_Result 
		As (
				SELECT	p.PersonelID,                                
				p.Code,               
				p.BirthCertificateNumber,
				p.Birthday,
				p.FatherName, 
				p.FatherName2,               
				p.InsuranceNumber,
				ISNULL((SELECT top 1 pms.MarriageStatus FROM hrm.PersonelMarriageStatus AS pms
				 WHERE pms.PersonelID=p.PersonelID
				 ORDER BY pms.ApplyDate desc
				),0) as MarriageStatus,              
				p.PartyID, 
				p.MarriageDate,
				p.ResidenceType,
				p.Blood,
				p.Disease,
				p.DiseaseDescriptopn,
				p.ExemptionCause,                
				p.Sex,
				p.TaxExempt,
				IsNull(p.TaxExemptionCause,0) as TaxExemptionCause,
				p.InsuranceType,
				ldi.Code AS NationalityCode,
				ldi.Title AS  NationalityTitle,
				p.BirthCertificateDate,
				p.[Version],
				p.Creator,
				p.CreationDate,		
				p.LastEditionDate,
				CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString, 
				Null AS MarriagePersianDate,
				CFG.GetCLRSaturnDate(p.Birthday, @DateFormat, 0, @DateType) AS BirthPersianDate,
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName,
				pa.IdentificationCode AS IdentificationCode,
				case '+@CultureNo+' when   1 then pa.Title when 2 then pa.Title2 end FName,
				case '+@CultureNo+' when   1 then pa.LastName when 2 then pa.LastName2 end LName,
				case '+@CultureNo+' when   1 then (pa.Title) + '' '' + ISNULL(pa.LastName, '''')
									when   2 then (pa.Title2) + '' '' + ISNULL(pa.LastName2, '''') end FullName,
				CAST(Case p.Sex WHEN 0 THEN @Man
								WHEN 1 THEN @Woman
								ELSE ''''
				END AS NVARCHAR(512))AS SexString,
				CAST(Case (SELECT top 1 pms.MarriageStatus FROM hrm.PersonelMarriageStatus AS pms
				 WHERE pms.PersonelID=p.PersonelID
				 ORDER BY pms.ApplyDate desc
				) WHEN 0 THEN @Single
										   WHEN 1 THEN @Married
										   WHEN 2 THEN @Moeil
										   ELSE ''''
				END AS NVARCHAR(512))AS MarriageStatusString,
				p.BirthLocationID,
				p.IssueLocationID,
				l2.Title AS BirthLocationTitle,
				l.Title AS IssueLocationTitle,
				c.CompanyID,
				c.Title AS CompanyTitle,
				Cast(isnull(vpsid.IsActive,0) as Bit) AS IsActive
			FROM HRM.Personel p
				Left JOIN cfg.Location AS l
				ON l.LocationID = p.IssueLocationID
				LEFT JOIN cfg.Location AS l2
				ON l2.LocationID =p.BirthLocationID
				JOIN CFG.[Party] AS pa ON pa.PartyID = P.PartyID 
				JOIN CFG.LookupDataItem AS ldi on ldi.LookupDataItemID = pa.Nationality
				JOIN CFG.[User] AS u ON u.UserID = p.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor		
				JOIN CFG.Company AS c ON c.CompanyID = p.CompanyID
				JOIN CFG.vwCompanyAccess a ON a.CompanyID = p.CompanyID 
				left join #vwPersonelStatusInDate vpsid on p.PersonelID = vpsid.PersonelID
			WHERE (@UserID = -1 
				or  (@ViewRelatedToUser is not null   and p.Creator = @UserID)
				or  (@ViewRelatedToOthers IS NOT NULL AND p.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)))
			)'
			
			
			
	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Code '
	
	
	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = ''
	ELSE
		 SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	
	
	SET @Query = Cfg.ApplyPaging (
			@tableName,
			@Query,
			@PageNumber,
			@RowspPage,
			@Filter,
			@Sort
		)
	--PRINT @Query
	
	EXECUTE sp_executesql @Query,
		 N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @UserID int ,
		 @ViewRelatedToUser int,
		 @Man VARCHAR(10),
		 @Woman VARCHAR(10),
		 @Single VARCHAR(10),
		 @Married VARCHAR(10),
		 @Moeil VARCHAR(10)
		 ',
		 @DateType = @DateType,
		 @DateFormat = @DateFormat,
		 @ViewRelatedToUser = @ViewRelatedToUser,
		 @UserID = @UserID,
		 @ViewRelatedToOthers = @ViewRelatedToOthers,
		 @UnauthorizedUsers = @UnauthorizedUsers,
		 @Man =@Man,
		 @Woman =@Woman,
		 @Single =@Single,
		 @Married=@Married,
		 @Moeil =@Moeil
	--WHERE  ttt.PersonelID = 6582
	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN')
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
		 N'@count int out',
		 @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
