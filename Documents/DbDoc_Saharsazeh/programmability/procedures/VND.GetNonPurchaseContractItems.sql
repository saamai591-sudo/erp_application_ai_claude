
-------------Start of #8033
CREATE   PROCEDURE [VND].GetNonPurchaseContractItems
(
    @stockId INT,
    @dlId INT ,
    @date DATE ,
    @financialPeriodId INT 
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT ,
        @DateType TINYINT ,
        @DateFormat NVARCHAR(10),
		@Culture NVARCHAR(5),
		@CultureNo tinyint

	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SET @UserID = CFG.GetuserID();

    SELECT  @DateType =CAST( us.SettingValue as tinyint)
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = N'Date_Type'
            AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN N'fa' THEN 0
                            WHEN N'en' THEN 1
                            WHEN N'ar' THEN 2
                        END;

    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

		select * into #vwStuff 
		from stf.VWStuff

		select * into #vwStuffStock_ForPursuiteGroup
		from stf.vwStuffStock_ForPursuiteGroup


    SELECT  pii.PurchaseContractItemID ,
            pii.PurchaseContractID ,
			pii.RowIndex,
            pin.Number ,
            CFG.GetCLRSaturnDate(pin.[Date], @DateFormat, 0, @DateType) DateString ,
            pin.InvoiceNumber ,
            CFG.GetCLRSaturnDate(pin.[InvoiceDate], @DateFormat, 0, @DateType) InvoiceDateString ,
            pii.StuffID ,
            s.Code StuffCode ,
			CASE @CultureNo
				WHEN 1 THEN s.Title
				WHEN 2 THEN s.Title2
		    END AS StuffTitle ,
            s.StuffDetailType,
            pii.MainQuantity ,
            pii.SubQuantity ,
            pir.Non ,
            pir.NonSub ,
            pii.Fee ,
            pii.Discount,
            case @CultureNo
				when 1 then pii.[Description]
				when 2 then pii.Description2
		    end as PurchaseContractItemDescription
    FROM    VND.PurchaseContractItem pii
            JOIN VND.PurchaseContract pin ON pin.PurchaseContractID = pii.PurchaseContractID
            JOIN VND.PurchaseContract_Remains pir ON pir.PurchaseContractItemID = pii.PurchaseContractItemID
            JOIN #vwStuff s ON s.StuffID = pii.StuffID
			join #vwStuffStock_ForPursuiteGroup vsfpg on pii.StuffID = vsfpg.StuffID and isnull(vsfpg.StockID,@stockId) = @stockId
            JOIN ( SELECT   BranchID
                    FROM     STF.Stock
                    WHERE    StockID = @stockId
                    ) st ON st.BranchID = pin.BranchID
    WHERE   pir.Non > 0
            AND s.[Type] = 0
            AND pin.DlID = @dlId
            AND pin.[Date] <= @date
            AND pin.[Status] <> 3
END;
