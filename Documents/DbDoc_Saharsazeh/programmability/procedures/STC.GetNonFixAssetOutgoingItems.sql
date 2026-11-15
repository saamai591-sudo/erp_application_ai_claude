-------------------------------------
CREATE   PROCEDURE [STC].GetNonFixAssetOutgoingItems
(
    @BranchId INT,
    @Date DATE, 
    @ContainAssets bit
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @userId INT = CFG.GetuserID(),
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT oi.OutgoingItemID,
           o.Number,
           CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) DateString,
           oi.StuffID,
           [STF].[GetStuffCode](s.StuffID) StuffCode,
           s.Title StuffTitle,
           s.Title2 StuffTitle2,
           oi.MainQuantity,
           oi.SubQuantity,
           orr.Non,
           orr.NonSub,
           oi.Fee,
           oi.Price
    FROM STC.OutgoingItem oi
        JOIN STC.Outgoing o
            ON o.OutgoingID = oi.OutgoingID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STF.VWStuff s
            ON s.StuffID = oi.StuffID
        JOIN SLE.Outgoing_Return_Remain orr
            ON orr.OutgoingItemID = oi.OutgoingItemID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN STF.Stock st
            ON o.StockID = st.StockID
    WHERE orr.Non > 0
      AND (
              sdt.DocumentType = 19 --FixAsset
              OR (@ContainAssets = 1 AND sdt.DocumentType = 8) --Asset
          )
      AND st.BranchID = @BranchId
      AND o.Date <= @Date;

END;
