------------------------------------- START #8503
CREATE     PROCEDURE [SLE].PriceListReview
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10),
			@CultureNo tinyint;


    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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


		select *
		into #Stuff
		from STF.[VWStuff]

		select *
		into #SaleModel
		from sle.vwSaleModelAccess

    SELECT   pli.PriceListItemID ,
    pli.PriceListID As DocumentID,
    'PriceList' As [Document],
             sm.Title ,
			 sm.Title2,
             pl.EffectiveDate ,
             pli.Fee ,
			 case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle,
             s.Code ,
             s.Barcode ,
			 pl.EffectiveDate,
             CFG.GetCLRSaturnDate(pl.EffectiveDate, @DateFormat, 0, @DateType) AS Date_EffectiveDate
    FROM     SLE.PriceListItem AS pli
             INNER JOIN SLE.PriceList AS pl ON pl.PriceListID = pli.PriceListID
             INNER JOIN SLE.SaleModel AS sm ON sm.SaleModelID = pl.SaleModelID
             INNER JOIN #Stuff AS s ON s.StuffID = pli.StuffID
             INNER JOIN #SaleModel AS vsma ON vsma.SaleModelID = sm.SaleModelID
    ORDER BY pl.EffectiveDate DESC ,
             s.StuffID;
