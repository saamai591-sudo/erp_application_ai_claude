CREATE   PROC [VND].RptFlowReview
(
    @FinicialPeriodID INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedBranchs NVARCHAR(MAX) = NULL,
    @SelectedVendors NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedPurchaseTypes NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION 
AS
BEGIN
    SET ANSI_NULLS OFF;

    create table #SelectedVendor 
    (
        DlID INT
    );
    create table #SelectedBranch 
    (
        StuffID INT
    );
    create table #SelectedStuff 
    (
        StuffID INT
    );
    create table #SelectedPurchaseType 
    (
        PurchaseTypeID INT
    );

    DECLARE @baseCurrencyPrecision INT = [CFG].[GetBaseCurrencyPrecision]();

		DECLARE @Culture NVARCHAR(100),
				@CultureNo TINYINT,
				@UserID int ;

		set @UserID = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		SELECT @CultureNo = CultureNo
		FROM CFG.CultureInfo
		WHERE Culture = @Culture;

    DECLARE @IsVendor BIT = 1,
            @IsBranch BIT = 1,
            @IsStuff BIT = 1,
            @IsPurchaseType BIT = 1;

    IF (@SelectedStuffs IS NULL OR @SelectedStuffs = '')
        SET @IsStuff = 0;

    IF (@SelectedBranchs IS NULL OR @SelectedBranchs = '')
        SET @IsBranch = 0;

    IF (@SelectedVendors IS NULL OR @SelectedVendors = '')
        SET @IsVendor = 0;

    IF (@SelectedPurchaseTypes IS NULL OR @SelectedPurchaseTypes = '')
        SET @IsPurchaseType = 0;


    INSERT INTO #SelectedVendor
    SELECT CAST(value AS int)
    FROM CFG.R_FnCommaStr2Table(@SelectedVendors);

    INSERT INTO #SelectedBranch
    SELECT CAST(value AS int)
    FROM CFG.R_FnCommaStr2Table(@SelectedBranchs);

    INSERT INTO #SelectedStuff
    SELECT CAST(value AS int)
    FROM CFG.R_FnCommaStr2Table(@SelectedStuffs);

    INSERT INTO #SelectedPurchaseType
    SELECT CAST(value AS int)
    FROM CFG.R_FnCommaStr2Table(@SelectedPurchaseTypes);

	DECLARE @WithoutBase  NVARCHAR(100),
			@PurchaseRequest  NVARCHAR(100),
			@Contract  NVARCHAR(100),
			@ContractStatement  NVARCHAR(100),
			@Proposal  NVARCHAR(100),
			@StockReceipt  NVARCHAR(100),
			@StuffRequest  NVARCHAR(100),
			@PurchaseContract  NVARCHAR(100),
			@Proforma  NVARCHAR(100),
			@ReturnReceipt  NVARCHAR(100),
			@PurchaseInvoice NVARCHAR(100)

    SELECT @WithoutBase = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'WithoutBase'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @PurchaseRequest = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'PurchaseRequest'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Contract = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'Contract'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @ContractStatement = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'ContractStatement'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Proposal = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'Proposal'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @StockReceipt = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'StockReceipt'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @PurchaseContract  = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'PurchaseContract'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Proforma  = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PurchaseDocumentBases'
          AND le.Item = 'Proforma'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @PurchaseInvoice = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'PurchaseInvoice'
          AND lev.Culture = CFG.GetuserCulture();
          
          
          SELECT * into #vwPartyAccess
          FROM cfg.vwPartyAccess AS vpa
          
          SELECT * into #vwBranchAccess
          FROM cfg.vwBranchAccess AS vba
          
          SELECT * into #vwStuff
          FROM stf.VWStuff AS v
          
          
    CREATE TABLE #Items
    (
        ResItemID INT IDENTITY(1, 1),
        InvoiceID INT,
        ItemID INT,
        ItemType INT,
        Type INT,
        Number INT,
        DATE DATE,
        CurrencyID INT,
        CurrencyRate DECIMAL(20, 4),
        StuffID INT NULL,
        MainQuantity DECIMAL(20, 4),
        SubQuantity DECIMAL(20, 4),
        Fee DECIMAL(20, 4),
        Price DECIMAL(38, 8),
        Discount DECIMAL(38, 8),
        Tax DECIMAL(38, 8),
        Duty DECIMAL(38, 8),
        Net DECIMAL(38, 8),
        DlID BIGINT,
        Description NVARCHAR(MAX),
        InvoiceNumber NVARCHAR(100),
        InvoiceDate NVARCHAR(50),
        VoucherNumber INT,
        VoucherDate DATE,
		VoucherReferenceNumber INT,
		BaseType NVARCHAR(100),
		BaseNumber NVARCHAR(100) null
    );

    INSERT INTO #Items
    SELECT I.PurchaseInvoiceID AS InvoiceID,
           PurchaseInvoiceItemID AS ItemID,
           0 AS ItemType,
           H.[Type],
           H.Number,
           H.Date,
           H.CurrencyID,
           H.CurrencyRate,
           StuffID,
           MainQuantity,
           SubQuantity,
           ROUND(   I.Fee * (CASE
                                 WHEN c.IsBaseCurrencyBasis = 0 THEN
                                     H.CurrencyRate
                                 ELSE
                                     1 / H.CurrencyRate
                             END
                            ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Fee,
           ROUND(   I.Price * (CASE
                                   WHEN c.IsBaseCurrencyBasis = 0 THEN
                                       H.CurrencyRate
                                   ELSE
                                       1 / H.CurrencyRate
                               END
                              ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Price,
           -ROUND(   I.Discount * (CASE
                                       WHEN c.IsBaseCurrencyBasis = 0 THEN
                                           H.CurrencyRate
                                       ELSE
                                           1 / H.CurrencyRate
                                   END
                                  ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Discount,
           ROUND(   I.Tax * (CASE
                                 WHEN c.IsBaseCurrencyBasis = 0 THEN
                                     H.CurrencyRate
                                 ELSE
                                     1 / H.CurrencyRate
                             END
                            ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Tax,
           ROUND(   I.Duty * (CASE
                                  WHEN c.IsBaseCurrencyBasis = 0 THEN
                                      H.CurrencyRate
                                  ELSE
                                      1 / H.CurrencyRate
                              END
                             ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Duty,
           ROUND(   I.Net * (CASE
                                 WHEN c.IsBaseCurrencyBasis = 0 THEN
                                     H.CurrencyRate
                                 ELSE
                                     1 / H.CurrencyRate
                             END
                            ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Net,
           H.DlID,
            case when @CultureNo = 1 then  I.[Description] else  I.[Description2] end  ,
           H.InvoiceNumber,
           H.InvoiceDate,
           v.Number AS VoucherNumber,
           v.Date AS VoucherDate,
		   v.ReferenceNumber,
		   case
				when H.BaseType=1 then @WithoutBase
				when H.BaseType=2 then @PurchaseRequest
				when H.BaseType=3 then @Contract
				when H.BaseType=4 then @ContractStatement
				when H.BaseType=5 then @Proposal
				when H.BaseType=6 then @StockReceipt
				when H.BaseType=8 then @PurchaseContract
				when H.BaseType=9 then @Proforma
		   end as BaseType,
				 CASE
					WHEN H.BaseType = 2 THEN CAST(purchaseRequestBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 3 THEN Cast(contractBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 4 THEN Cast(contractStatementBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 5 THEN Cast(proposalBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 6 THEN Cast(stockReceiptBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 8 THEN Cast(purchaseContractBase.Number AS NVARCHAR(100))
					WHEN H.BaseType = 9 THEN Cast(proformaInvoiceBase.Number AS NVARCHAR(100))
					END AS BaseNumber
    FROM VND.PurchaseInvoiceItem I
        JOIN VND.PurchaseInvoice H
            ON I.PurchaseInvoiceID = H.PurchaseInvoiceID
         LEFT JOIN (
			SELECT PrevoucherID,
				VoucherID
			FROM ACC.VoucherPrevoucher
			GROUP BY PrevoucherID, VoucherID
		) vp
		ON vp.PrevoucherID = H.PreVoucherID
		LEFT JOIN ACC.Voucher v
		ON v.VoucherID = vp.VoucherID
        JOIN CFG.Currency c
            ON c.CurrencyID = H.CurrencyID
       INNER JOIN #vwBranchAccess AS vba ON vba.BranchID =  H.BranchID
       join #vwPartyAccess AS vpa on vpa.DlID = h.DlID
		left join (
					select a.PurchaseRequestItemID, b.PurchaseRequestNumber AS Number from REQ.PurchaseRequestItem a
					join req.PurchaseRequest b on a.PurchaseRequestID = b.PurchaseRequestID

					) purchaseRequestBase on I.PurchaseRequestItemID = purchaseRequestBase.PurchaseRequestItemID and H.BaseType=2
		left join (
					select c.Number as Number,cs.ContractSubjectID from CNT.Contract as c
					join CNT.ContractSubject as cs on cs.ContractID=c.ContractID
					) contractBase on I.ContractSubjectID=contractBase.ContractSubjectID and h.BaseType=3
		left join (
					select c.Number,css.ContractSubjectID from CNT.ConfirmStatement as cs
					join CNT.Contract as c on c.ContractID=cs.ContractID
					join CNT.ContractSubject as css on css.ContractID=c.ContractID
					) as contractStatementBase on i.ContractSubjectID=contractStatementBase.ContractSubjectID and h.BaseType=4
		left join (
					select p.Number,[pi].ProposalItemID from VND.ProposalItem as [pi]
					join VND.Proposal as p on p.ProposalID=[pi].ProposalItemID
				) as proposalBase on I.ProposalItemID=proposalBase.ProposalItemID and h.BaseType=5
		left join (
					select sri.StockReceiptItemID,sr.Number from STC.StockReceiptItem as sri
					join STC.StockReceipt as sr on sr.StockReceiptID=sri.StockReceiptID
					) as stockReceiptBase on I.StockReceiptItemID=stockReceiptBase.StockReceiptItemID and H.BaseType=6
		left join (
					select pc.Number , pci.PurchaseContractItemID from VND.PurchaseContractItem as pci
					join VND.PurchaseContract as pc on pc.PurchaseContractID=pci.PurchaseContractID
					) as purchaseContractBase on i.PurchaseContractItemID=purchaseContractBase.PurchaseContractItemID and H.BaseType=8
		left join(
					select [pi].Number,pii.ProformaInvoiceItemID from FOS.ProformaInvoiceItem as pii
					join FOS.ProformaInvoice as [pi] on [pi].ProformaInvoiceID=pii.ProformaInvoiceID
				) as proformaInvoiceBase on i.ProformaInvoiceItemID=proformaInvoiceBase.ProformaInvoiceItemID and H.BaseType=9

    WHERE
        (
            @FromDate IS NULL
            OR H.Date >= @FromDate
        )
        AND
        (
            @ToDate IS NULL
            OR H.Date <= @ToDate
        )
        AND
        (
            @IsVendor = 0
            OR H.DlID IN
               (
                   SELECT DlID FROM #SelectedVendor
               )
        )
        AND
        (
            @IsBranch = 0
            OR H.BranchID IN
               (
                   SELECT StuffID FROM #SelectedBranch
               )
        )
        AND
        (
            @IsStuff = 0
            OR I.StuffID IN
               (
                   SELECT StuffID FROM #SelectedStuff
               )
        )
        AND
        (
            @IsPurchaseType = 0
            OR H.[Type] IN
               (
                   SELECT PurchaseTypeID FROM #SelectedPurchaseType
               )
        )OPTION(RECOMPILE);

    INSERT INTO #Items
    SELECT I.ReturnInvoiceID AS InvoiceID,
           ReturnInvoiceItemID AS ItemID,
           1 AS ItemType,
           H.[Type],
           H.Number,
           H.Date,
           H.CurrencyID,
           H.CurrencyRate,
           StuffID,
           -MainQuantity,
           -SubQuantity,
           ROUND(   I.Fee * (CASE
                                 WHEN c.IsBaseCurrencyBasis = 0 THEN
                                     H.CurrencyRate
                                 ELSE
                                     1 / H.CurrencyRate
                             END
                            ) / c.ExchangeUnit,
                    @baseCurrencyPrecision
                ) AS Fee,
           -ROUND(   I.Price * (CASE
                                    WHEN c.IsBaseCurrencyBasis = 0 THEN
                                        H.CurrencyRate
                                    ELSE
                                        1 / H.CurrencyRate
                                END
                               ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Price,
           +ROUND(   I.Discount * (CASE
                                       WHEN c.IsBaseCurrencyBasis = 0 THEN
                                           H.CurrencyRate
                                       ELSE
                                           1 / H.CurrencyRate
                                   END
                                  ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Discount,
           -ROUND(   I.Tax * (CASE
                                  WHEN c.IsBaseCurrencyBasis = 0 THEN
                                      H.CurrencyRate
                                  ELSE
                                      1 / H.CurrencyRate
                              END
                             ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Tax,
           -ROUND(   I.Duty * (CASE
                                   WHEN c.IsBaseCurrencyBasis = 0 THEN
                                       H.CurrencyRate
                                   ELSE
                                       1 / H.CurrencyRate
                               END
                              ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Duty,
           -ROUND(   I.Net * (CASE
                                  WHEN c.IsBaseCurrencyBasis = 0 THEN
                                      H.CurrencyRate
                                  ELSE
                                      1 / H.CurrencyRate
                              END
                             ) / c.ExchangeUnit,
                     @baseCurrencyPrecision
                 ) AS Net,
           H.DlID,
           case when @CultureNo = 1 then  I.[Description] else  I.[Description2] end  ,
           NULL InvoiceNumber,
           NULL InvoiceDate,
           v.Number AS VoucherNumber,
           v.Date AS VoucherDate,
		   v.ReferenceNumber,
           case 
              when  I.PurchaseInvoiceItemID is not null
				then @PurchaseInvoice
				else @WithoutBase
           end as BaseType,
           case 
              when  I.PurchaseInvoiceItemID is not null
				then CAST(purchaseInvoiceBase.Number AS NVARCHAR(100))
				else null
					END AS BaseNumber
    FROM VND.ReturnInvoiceItem I
        JOIN VND.ReturnInvoice H
            ON I.ReturnInvoiceID = H.ReturnInvoiceID
        LEFT JOIN (
			SELECT PrevoucherID,
				VoucherID
			FROM ACC.VoucherPrevoucher
			GROUP BY PrevoucherID, VoucherID
		) AS vp 
            ON vp.PrevoucherID=H.PreVoucherID
        LEFT JOIN ACC.Voucher AS v 
            ON v.VoucherID=vp.VoucherID
        JOIN CFG.Currency c
            ON c.CurrencyID = H.CurrencyID
		INNER JOIN #vwBranchAccess AS vba ON vba.BranchID =  H.BranchID
		join #vwPartyAccess AS vpa on vpa.DlID = H.DlID
		left join (
			select [pi].Number,pii.PurchaseInvoiceItemID from [VND].[PurchaseInvoiceItem] as pii
			join VND.PurchaseInvoice as [pi] on [pi].PurchaseInvoiceID=pii.PurchaseInvoiceID
		) as purchaseInvoiceBase on I.PurchaseInvoiceItemID=purchaseInvoiceBase.PurchaseInvoiceItemID and I.PurchaseInvoiceItemID is not null
    WHERE  
        (
            @FromDate IS NULL
            OR H.Date >= @FromDate
        )
        AND
        (
            @ToDate IS NULL
            OR H.Date <= @ToDate
        )
        AND
        (
            @IsVendor = 0
            OR H.DlID IN
               (
                   SELECT DlID FROM #SelectedVendor
               )
        )
        AND
        (
            @IsBranch = 0
            OR H.BranchID IN
               (
                   SELECT StuffID FROM #SelectedBranch
               )
        )
        AND
        (
            @IsStuff = 0
            OR I.StuffID IN
               (
                   SELECT StuffID FROM #SelectedStuff
               )
        )
        AND
        (
            @IsPurchaseType = 0
            OR H.[Type] IN
               (
                   SELECT PurchaseTypeID FROM #SelectedPurchaseType
               )
        )OPTION(RECOMPILE);

    DECLARE 
            @ReturnInvoice NVARCHAR(100),
            @DateType TINYINT,
            @DateFormat VARCHAR(10)

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId
		  OPTION(RECOMPILE);

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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
          AND us.UserID = @userId
		  OPTION(RECOMPILE);

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';



    SELECT @ReturnInvoice = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'ReturnInvoice'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT ResItemID,
           InvoiceID,
           CASE
               WHEN ref.ItemType = 0 THEN
                   @PurchaseInvoice
               ELSE
                   @ReturnInvoice
           END AS DocName,
           case when @CultureNo = 1 then pt.Title else pt.Title2 end AS [Type],
           Number,
           ref.[DATE] AS Date,
           [CFG].[GetCLRSaturnDate](DATE, @DateFormat, 0, @DateType) Date_Date,
           case when @CultureNo = 1 then cur.Title else cur.Title2 end AS CurrencyTitle,
           CurrencyRate,
           [STF].[GetStuffCode](stf.StuffID) AS StuffCode,
           case when @CultureNo = 1 then stf.Title else stf.Title2 end  StuffTitle,
           MainQuantity,
           SubQuantity,
           Fee,
           Price,
           Discount,
           Tax,
           Duty,
           Net,
           ItemType,
           ref.ItemID,
           d.Code AS DlCode,
           case when @CultureNo = 1 then d.Title else d.Title2 end   DlTitle,
           ref.Description DESCRIPTION,
           ref.InvoiceNumber,
           ref.InvoiceDate,
           [CFG].[GetCLRSaturnDate](ref.InvoiceDate, @DateFormat, 0, @DateType) Date_InvoiceDate,
           ref.VoucherNumber,
           ref.VoucherDate,
           [CFG].[GetCLRSaturnDate](ref.VoucherDate, @DateFormat, 0, @DateType) Date_VoucherDate,
		   ref.VoucherReferenceNumber,
		   ref.BaseType,
		   CAST(ref.BaseNumber AS NVARCHAR(100)) AS BaseNumber
    FROM #Items ref
        INNER JOIN CFG.Currency cur
            ON ref.CurrencyID = cur.CurrencyID
        JOIN ACC.DL d
            ON d.DLID = ref.DlID            
        INNER JOIN #VWStuff stf
            ON ref.StuffID = stf.StuffID
        INNER JOIN VND.PurchaseType AS pt
            ON pt.PurchaseTypeID = ref.[Type];
END;
