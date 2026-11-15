CREATE   PROCEDURE [STC].GetNonStockReceiptItem
    (
        @stockReceiptId INT = NULL,
        @branchId INT ,
        @financialPeriodId INT ,
        @date DATE ,
        @dlId BIGINT ,
        @currencyId INT
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Culture VARCHAR(10) ,
                @query NVARCHAR(MAX),
				@PrecisionCount INT,
			    @CultureNo tinyint
	    		

        SET @UserID = CFG.GetuserID();
		SET @Culture = cfg.GetuserCulture()	

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture;

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

		SELECT @PrecisionCount = c.PrecisionCount FROM CFG.Currency AS c WHERE c.CurrencyID = @currencyId

        SELECT @DateFormat = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @UserID;

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';

        SELECT sr.StockReceiptID ,
               sri.StockReceiptItemID ,
               sri.RowIndex ,
               sr.Number ,
               CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) DateString ,
               sri.StuffID ,
               s.Code StuffCode ,
               s.Barcode,
               s.IranCode,
			   case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
			   end as StuffTitle ,
               case @CultureNo
					when 1 then s.MainMeasureUnit
					when 2 then s.MainMeasureUnit2
			   end as MainUnit,
               sri.MainQuantity ,
               sri.SubQuantity ,
               srr.Non ,
               srr.NonSub ,
               case @CultureNo
					when 1 then sdt.Title
					when 2 then sdt.Title2
			   end as TypeString ,
               -------------      base Price     --------------
               CASE WHEN u1.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u1.ProposalMainQuantity THEN
                                 u1.Price
                             ELSE
                                 ROUND(
                                     ( u1.Price / u1.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u2.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u2.ProposalMainQuantity THEN
                                 u2.Price
                             ELSE
                                 ROUND(
                                     ( u2.Price / u2.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u3.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u3.ProposalMainQuantity THEN
                                 u3.Price
                             ELSE
                                 ROUND(
                                     ( u3.Price / u3.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u4.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u4.MainQuantity THEN u4.Price
                             ELSE
                                 ROUND(
                                     ( u4.Price / u4.MainQuantity ) * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u5.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u5.MainQuantity THEN u5.Price
                             ELSE
                                 ROUND(
                                     ( u5.Price / u5.MainQuantity ) * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u6.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u6.MainQuantity THEN u6.Price
                             ELSE
                                 ROUND(
                                     ( u6.Price / u6.MainQuantity ) * srr.Non ,
                                     @PrecisionCount)
                        END
                         WHEN u7.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u7.MainQuantity THEN u7.Price
                             ELSE
                                 ROUND(
                                     ( u7.Price / u7.MainQuantity ) * srr.Non ,
                                     @PrecisionCount)
                        END
                         WHEN u8.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u8.MainQuantity THEN u8.Price
                             ELSE
                                 ROUND(
                                     ( u8.Price / u8.MainQuantity ) * srr.Non ,
                                     @PrecisionCount)
                        END
                    ELSE 0
               END AS Price ,
               -------------      discount     --------------
               CASE WHEN u1.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u1.ProposalMainQuantity THEN
                                 u1.Discount
                             ELSE
                                 ROUND(
                                     ( u1.Discount / u1.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u2.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u2.ProposalMainQuantity THEN
                                 u2.Discount
                             ELSE
                                 ROUND(
                                     ( u2.Discount / u2.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u3.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u3.ProposalMainQuantity THEN
                                 u3.Discount
                             ELSE
                                 ROUND(
                                     ( u3.Discount / u3.ProposalMainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u4.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u4.MainQuantity THEN u4.Discount
                             ELSE
                                 ROUND(
                                     ( u4.Discount / u4.MainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u5.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u5.MainQuantity THEN u5.Discount
                             ELSE
                                 ROUND(
                                     ( u5.Discount / u5.MainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    WHEN u6.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u6.MainQuantity THEN u6.Discount
                             ELSE
                                 ROUND(
                                     ( u6.Discount / u6.MainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                         WHEN u7.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u7.MainQuantity THEN u7.Discount
                             ELSE
                                 ROUND(
                                     ( u7.Discount / u7.MainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                          WHEN u8.StockReceiptItemID IS NOT NULL THEN
                        CASE WHEN srr.Non = u8.MainQuantity THEN u8.Discount
                             ELSE
                                 ROUND(
                                     ( u8.Discount / u8.MainQuantity )
                                     * srr.Non ,
                                     @PrecisionCount)
                        END
                    ELSE 0
               END AS Discount ,           
               -------------      BaseMainQuantity     --------------
               CASE WHEN u1.StockReceiptItemID IS NOT NULL THEN
                        u1.ProposalMainQuantity
                    WHEN u2.StockReceiptItemID IS NOT NULL THEN
                        u2.ProposalMainQuantity
                    WHEN u3.StockReceiptItemID IS NOT NULL THEN
                        u3.ProposalMainQuantity
                    WHEN u4.StockReceiptItemID IS NOT NULL THEN
                        u4.MainQuantity
                    WHEN u5.StockReceiptItemID IS NOT NULL THEN
                        u5.MainQuantity
                    WHEN u6.StockReceiptItemID IS NOT NULL THEN
                        u6.MainQuantity
                    ELSE 0
               END AS BaseMainQuantity
        FROM   STC.StockReceiptItem sri
               JOIN STC.StockReceipt sr ON sr.StockReceiptID = sri.StockReceiptID
               JOIN STF.[VWStuff] s ON s.StuffID = sri.StuffID
               JOIN STC.StockReceipt_Remains srr ON srr.StockReceiptItemID = sri.StockReceiptItemID
               JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
               JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
               JOIN STF.Stock st ON st.StockID = sr.StockID
                                    AND st.BranchID = @branchId
               LEFT JOIN (   SELECT sri.StockReceiptItemID ,
                                    pi.Discount ,
                                    pi.Price ,
                                    pi.MainQuantity AS ProposalMainQuantity
                             FROM   VND.ProposalItem AS pi
                                    JOIN VND.Proposal AS p ON p.ProposalID = pi.ProposalID
                                    JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi.ProposalItemID
                                    JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
                             WHERE  p.CurrencyID = @currencyId ) u1 ON u1.StockReceiptItemID = sri.StockReceiptItemID
               LEFT JOIN (   SELECT sri.StockReceiptItemID ,
                                    pi.Discount ,
                                    pi.Price ,
                                    pi.MainQuantity AS ProposalMainQuantity
                             FROM   VND.ProposalItem AS pi
                                    JOIN VND.Proposal AS p ON p.ProposalID = pi.ProposalID
                                    JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi.ProposalItemID
                                    JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                                    JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
                             WHERE  p.CurrencyID = @currencyId ) u2 ON u2.StockReceiptItemID = sri.StockReceiptItemID
               LEFT JOIN (   SELECT sri.StockReceiptItemID ,
                                    pi.Price ,
                                    pi.Discount ,
                                    pi.MainQuantity AS ProposalMainQuantity
                             FROM   VND.ProposalItem AS pi
                                    JOIN VND.Proposal AS p ON p.ProposalID = pi.ProposalID
                                    JOIN STC.StockReceiptItem AS sri ON sri.ProposalItemID = pi.ProposalItemID
                             WHERE  p.CurrencyID = @currencyId ) u3 ON u3.StockReceiptItemID = sri.StockReceiptItemID
               LEFT JOIN (   SELECT pci.Price ,
                                    pci.Discount ,
                                    pci.MainQuantity ,
                                    sri.StockReceiptItemID
                             FROM   VND.PurchaseContractItem AS pci
                                    JOIN VND.PurchaseContract AS pc ON pc.PurchaseContractID = pci.PurchaseContractID
                                    JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
                                    JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                                    JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
                             WHERE  pc.CurrencyID = @currencyId ) u4 ON u4.StockReceiptItemID = sri.StockReceiptItemID
               LEFT JOIN (   SELECT pci.Price ,
                                    pci.Discount ,
                                    pci.MainQuantity ,
                                    sri.StockReceiptItemID
                             FROM   VND.PurchaseContractItem AS pci
                                    JOIN VND.PurchaseContract AS pc ON pc.PurchaseContractID = pci.PurchaseContractID
                                    JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
                             WHERE  pc.CurrencyID = @currencyId ) u5 ON u5.StockReceiptItemID = sri.StockReceiptItemID
               LEFT JOIN (   SELECT pci.Price ,
                                    pci.Discount ,
                                    pci.MainQuantity ,
                                    sri.StockReceiptItemID
                             FROM   VND.PurchaseContractItem AS pci
                                    JOIN VND.PurchaseContract AS pc ON pc.PurchaseContractID = pci.PurchaseContractID
                                    JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
                                    JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
                             WHERE  pc.CurrencyID = @currencyId ) u6 ON u6.StockReceiptItemID = sri.StockReceiptItemID
                LEFT JOIN (   SELECT pci.Price ,
                                    pci.Discount ,
                                    pci.MainQuantity ,
                                    sri.StockReceiptItemID
                             FROM   VND.PurchaseContractItem AS pci
                                    JOIN VND.PurchaseContract AS pc ON pc.PurchaseContractID = pci.PurchaseContractID
                                    join vnd.DeliveryJustificationItem dji on pci.PurchaseContractItemID = dji.PurchaseContractItemID
                                    JOIN STC.StockReceiptItem AS sri ON sri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
                             WHERE  pc.CurrencyID = @currencyId ) u7 ON u7.StockReceiptItemID = sri.StockReceiptItemID
                             
                 LEFT JOIN (   SELECT pci.Price ,
                                    pci.Discount ,
                                    pci.MainQuantity ,
                                    sri.StockReceiptItemID
                             FROM   VND.PurchaseContractItem AS pci
                                    JOIN VND.PurchaseContract AS pc ON pc.PurchaseContractID = pci.PurchaseContractID
                                    join vnd.DeliveryJustificationItem dji on pci.PurchaseContractItemID = dji.PurchaseContractItemID
                                    join stc.TemporaryStockReceiptItem AS tsri on tsri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
                                    join stc.JustificationInputItem AS jii on jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                                    JOIN STC.StockReceiptItem AS sri on jii.JustificationInputItemID = sri.JustificationInputItemID
                             WHERE  pc.CurrencyID = @currencyId ) u8 ON u8.StockReceiptItemID = sri.StockReceiptItemID        
                             
        WHERE  (@stockReceiptId IS NULL OR sr.StockReceiptID = @stockReceiptId) 
               AND srr.Non > 0
               AND (   sdt.DocumentType = 1
                       OR sdt.DocumentType = 2 )
               AND sdtb.BaseEntity <> 10
               AND sr.[Date] <= @date
               AND sr.DeliverDlID = @dlId
               AND sri.PurchaseInvoiceItemID IS NULL
			   AND sri.Price = 0
    END;

