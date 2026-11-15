-------------------------------------
CREATE     PROC [AST].AssetCard_AssetSetting
    (
        @AssetID INT
    )
--WITH ENCRYPTION 
AS
BEGIN

		DECLARE @Culture varchar(25),
		        @CultureNo tinyint,
				@Unused varchar(25),
				@UserID INT ,
				@DateType VARCHAR(10) ,
				@DateFormat VARCHAR(10) ,
				@Working varchar(25)

		set @Culture = CFG.GetuserCulture() 
		SET @UserID = CFG.GetuserID();

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture

		SELECT @DateType = us.SettingValue
		FROM   CFG.UserSetting us
		WHERE  us.SettingKey = 'Date_Type'
			   AND us.UserID = @UserID;
		IF @DateType IS NULL
			SET @DateType = CASE @Culture
								 WHEN 'fa' THEN 0
								 WHEN 'en' THEN 1
								 WHEN 'ar' THEN 2
							END;

		SELECT @DateFormat = us.SettingValue
		FROM   CFG.UserSetting us
		WHERE  us.SettingKey = 'Date_Format'
			   AND us.UserID = @UserID;

		IF @DateFormat IS NULL
			SET @DateFormat = 'YY/MM/DD';

		SELECT @Unused = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'AssetUsageStatus'
			   AND L.Item = 'Unused'
			   AND LV.Culture = @Culture;

		SELECT @Working = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'AssetUsageStatus'
			   AND L.Item = 'Working'
			   AND LV.Culture = @Culture;

        SELECT CFG.GetCLRSaturnDate(ass.Date,@DateFormat   , 0, @DateType ) Date_Date ,
               ass.[Date] ,
               b.Code BranchCode ,
			   case when @CultureNo = 1 then b.Title
	                when @CultureNo = 2 then b.Title2
	           end as BranchTitle,                
			   case when @CultureNo = 1 then p1.Title + ' ' + ISNULL(p1.LastName, '')
	                when @CultureNo = 2 then p1.Title2 + ' ' + ISNULL(p1.LastName2, '')
	           end as Responsible,                
			   case when @CultureNo = 1 then p2.Title + ' ' + ISNULL(p2.LastName, '')
	                when @CultureNo = 2 then p2.Title2 + ' ' + ISNULL(p2.LastName2, '')
	           end as Deliverer,               
			   case when @CultureNo = 1 then d.Title
	                when @CultureNo = 2 then d.Title2
	           end as DeployPlace,
               CASE ass.Status
                    WHEN 1 THEN @Working 
                    WHEN 2 THEN @Unused
               END status,
			   cp.Number ChangePositionNumber,
			   CFG.GetCLRSaturnDate(cp.Date,@DateFormat   , 0, @DateType )  ChangePositionDate 
        FROM   AST.AssetSetting ass
		join AST.Asset a on ass.AssetID = a.AssetID
        JOIN CFG.Branch b ON b.BranchID = a.BranchID
        LEFT JOIN CFG.Party p1 ON p1.PartyID = ass.Responsible
        LEFT JOIN CFG.Party p2 ON p2.PartyID = ass.Deliverer
        LEFT JOIN AST.DeployPlace d ON d.DeployPlaceID = ass.DeployPlaceID
		LEFT JOIN AST.ChangePosition cp on cp.ChangePositionID = ass.ChangePositionID
        WHERE  ass.AssetID = @AssetID;
    END;
