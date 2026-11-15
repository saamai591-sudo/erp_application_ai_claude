
-----------------------------------------
CREATE   PROCEDURE [STC].GetStockReceiptList
(
	@FinancialPeriodID INT,
	@IsAmountList BIT,
	@PageNumber INT,
	@RowspPage INT,
	@Sort NVARCHAR(MAX) = NULL,
	@Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture VARCHAR(10),
			@Submit NVARCHAR(100),
			@Voucher NVARCHAR(100),
			@PreVoucher NVARCHAR(100),
			@Produce NVARCHAR(100),
			@Purchase NVARCHAR(100),
			@Spoilages NVARCHAR(100),
			@Trust NVARCHAR(100),
			@Transfer NVARCHAR(100),
			@Other NVARCHAR(100),
			@StockRecounting NVARCHAR(100),
			@AmountViewRelatedToUser INT,
			@QuantityViewRelatedToUser INT,
			@QuantityViewRelatedToOthersUserId INT,
			@AmountViewRelatedToOthersUserId INT,
			@QuantityViewRelatedToOthers NVARCHAR(MAX),
			@AmountViewRelatedToOthers NVARCHAR(MAX),
			@FirstInventory NVARCHAR(100),
			@PurchaseInvoice NVARCHAR(100),
			@StockReceipt NVARCHAR(100),
			@DeliveryJustification NVARCHAR(100),
			@PurchaseContract NVARCHAR(100),
			@Clearance NVARCHAR(100),
			@Contract NVARCHAR(100),
			@Outgoing NVARCHAR(100),
			@CultureNo TINYINT,
			@TemporaryReceipt NVARCHAR(100),
			@ReturnRequest NVARCHAR(100),
			@ProductionPlanning NVARCHAR(100),
			@ProductionStatistic NVARCHAR(100);

	---base document

	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
		
	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo 
	WHERE Culture = CFG.GetuserCulture();

	DECLARE @withoutBase NVARCHAR(100),
			@Proposal NVARCHAR(100),
			@PurchaseRequest NVARCHAR(100),
			@JustificationInput NVARCHAR(100);

	SELECT @TemporaryReceipt = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'TemporaryReceipt'
		  AND LV.Culture = @Culture;

	SELECT @ReturnRequest = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'ReturnRequest'
		  AND LV.Culture = @Culture;

	SELECT @ProductionPlanning = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'ProductionPlanning'
		  AND LV.Culture = @Culture;

	SELECT @ProductionStatistic = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'ProductionStatistic'
		  AND LV.Culture = @Culture;

		  -------------------------------

	SELECT @Outgoing = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'DocumentNumTypes'
		  AND L.Item = 'Outgoing'
		  AND LV.Culture = @Culture;

	SELECT @withoutBase = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'WithOutbase'
		  AND LV.Culture = @Culture;

	SELECT @Proposal = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'Proposal'
		  AND LV.Culture = @Culture;

	SELECT @PurchaseRequest = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'PurchaseRequest'
		  AND LV.Culture = @Culture;

	SELECT @JustificationInput = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'JustificationInput'
		  AND LV.Culture = @Culture;

	SELECT @PurchaseInvoice = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'PurchaseInvoice'
		  AND LV.Culture = @Culture;

	SELECT @StockReceipt = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'StockReceipt'
		  AND LV.Culture = @Culture;
	
	SELECT @DeliveryJustification = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'DeliveryJustification'
		  AND LV.Culture = @Culture;


	SELECT @PurchaseContract = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'PurchaseContract'
		  AND LV.Culture = @Culture;

	SELECT @Clearance = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'Clearance'
		  AND LV.Culture = @Culture;

	SELECT @Contract = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'TemporaryStockReceiptBaseType'
		  AND L.Item = 'Contract'
		  AND LV.Culture = @Culture;

	SELECT @FirstInventory = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'FirstInventory'
		  AND LV.Culture = @Culture;

	SELECT @StockRecounting = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'StockRecounting'
		  AND LV.Culture = @Culture;

	SELECT @Other = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Other'
		  AND LV.Culture = @Culture;

	SELECT @Transfer = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Transfer'
		  AND LV.Culture = @Culture;

	SELECT @Spoilages = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Spoilages'
		  AND LV.Culture = @Culture;

	SELECT @Trust = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Trust'
		  AND LV.Culture = @Culture;

	SELECT @Produce = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Produce'
		  AND LV.Culture = @Culture;

	SELECT @Purchase = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'StockReceiptTypes'
		  AND L.Item = 'Purchase'
		  AND LV.Culture = @Culture;

	SELECT @Submit = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'Statuses'
		  AND L.Item = 'Submit'
		  AND LV.Culture = @Culture;

	SELECT @Voucher = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'PreVoucherStatuses'
		  AND L.Item = 'Voucher'
		  AND LV.Culture = @Culture;

	SELECT @PreVoucher = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'PreVoucherStatuses'
		  AND L.Item = 'PreVoucher'
		  AND LV.Culture = @Culture;



	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @UserID;
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
		  AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	--AmountReceipt
	SELECT @AmountViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'AmountReceipt'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @AmountViewRelatedToOthersUserId = UserID,
		   @AmountViewRelatedToOthers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'AmountReceipt'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	--QuantityReceipt		
	SELECT @QuantityViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'QuantityReceipt'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @QuantityViewRelatedToOthersUserId = UserID,
		   @QuantityViewRelatedToOthers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'QuantityReceipt'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Number ';

	SELECT sri.StockReceiptID,
		   SUM(sri.Price) TotalInvoicePrice,
		   SUM(sri.EstimatedPrice) TotalEstimatedPrice,
		   SUM(sri.ShareOfCosts) TotalCosts,
		   SUM(sri.NetPrice) TotalNetPrice
	INTO #StockReceiptTotal
	FROM STC.StockReceiptItem AS sri
		JOIN STC.StockReceipt AS sr
			ON sr.StockReceiptID = sri.StockReceiptID
	WHERE sr.FinancialPeriodID = @FinancialPeriodID
	GROUP BY sri.StockReceiptID;

	DECLARE @Query NVARCHAR(MAX);
	SET @Query
		= N'
	select *
	into #vwStockDocumentsAccess
	from cfg.vwStockDocumentsAccess

	select *
	into #vwStockAccess
	from cfg.vwStockAccess

	select *
	into #vwVoucherPrevoucher
	from acc.vwVoucherPrevoucher
	where engname = ''StockReceipt''
	and FinancialPeriodID = @FinancialPeriodID

			;WITH Query_Result 
			(
				StockReceiptID , 
				StockDocumentTypeTitle,
				BaseEntity,
				BaseEntityTitle,
				AutoGenerated , 
				[Type], 
				StockDocumentTypeBaseEntityID,
				StockID , 
				DeliverDlID , 
				DeliverStockID, 
				Number , 
				[Date], 
				TotalInvoicePrice, 
				TotalEstimatedPrice, 
				TotalCosts, 
				TotalNetPrice,
				PreVoucherID, 
				OutgoingID, 
				[Version], 
				Creator , 
				CreationDate , 
				FinancialPeriodID ,
				StockCode ,
				StockTitle ,
				StockTitle2,
				DeliverCode,
				DeliverTitle,
				DeliverTitle2,
				Date_Date , 
				CreateDateString, 
				EditionDateString,
				CreatorUserName, 
				EditorName,
				VoucherID,
				VoucherNumber,
				VoucherDate,
				Date_VoucherDate,
				TypeString ,
				TypeString2 ,
				LastEditionDate,
				StateString
			)
			AS
			(
				SELECT *,
				CAST( CASE	WHEN T.VoucherID IS not null  THEN @Voucher
							WHEN T.PreVoucherID IS not null  THEN @PreVoucher
							ELSE @Submit  END AS NVARCHAR(512))AS StateString				
		FROM (SELECT	sr.StockReceiptID, 
						case @CultureNo
							when 1 then sdt.Title
							when 2 then sdt.Title2
						end as StockDocumentTypeTitle ,
						sdtb.BaseEntity,
						case sdtb.BaseEntity
							when 1 then @withoutBase
							when 2 then @PurchaseRequest
							when 3 then @Proposal
							when 4 then @TemporaryReceipt--
							when 5 then @ReturnRequest--
							when 6 then @JustificationInput	
							when 7 then @PurchaseInvoice
							When 8 THEN @PurchaseContract
							when 9 then @Outgoing
							When 10 THEN @Clearance
							When 11 THEN @Contract
							when 12 then @ProductionPlanning--
							when 13 then @ProductionStatistic--
							when 14 then @StockReceipt--
							when 15 then @DeliveryJustification--
						end AS BaseEntityTitle,
						sr.AutoGenerated, 
						sdt.[DocumentType], 
						sr.StockDocumentTypeBaseEntityID,
						sr.StockID, 
						sr.DeliverDlID, 
						sr.DeliverStockID, 
						sr.Number, 
						sr.[Date], 
						srt.TotalInvoicePrice, 
						srt.TotalEstimatedPrice, 
						srt.TotalCosts, 
						srt.TotalNetPrice,                       
						sr.PreVoucherID, 
						sr.OutgoingID, 
						sr.[Version], 
						sr.Creator, 
						sr.CreationDate, 
						sr.FinancialPeriodID,
						s.Code StockCode,
						s.Title StockTitle,
						s.Title2 StockTitle2,
						CASE WHEN sr.DeliverDlID IS NOT NULL THEN d.code ELSE cast(ds.Code as NVARCHAR(256)) END AS DeliverCode,
						CASE WHEN sr.DeliverDlID IS NOT NULL THEN d.Title ELSE ds.Title END AS DeliverTitle,
						CASE WHEN sr.DeliverDlID IS NOT NULL THEN d.Title2 ELSE ds.Title2 END AS DeliverTitle2,
						CFG.GetCLRSaturnDate(sr.[Date], @DateFormat  , 0, @DateType)   AS Date_Date, 
						CFG.GetCLRSaturnDate(sr.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
						CFG.GetCLRSaturnDate(sr.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
						u.Name AS CreatorUserName, 
						u2.Name AS EditorName,
						v.VoucherID AS VoucherID,
						v.ReferenceNumber AS VoucherNumber,
						v.Date VoucherDate,
						CFG.GetCLRSaturnDate(v.Date,  @DateFormat  ,0, @DateType) AS Date_VoucherDate,
						sdt.Title TypeString,
						sdt.Title2 TypeString2,
						sr.LastEditionDate
				FROM         STC.StockReceipt AS sr
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
					ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				INNER JOIN #StockReceiptTotal srt ON srt.StockReceiptID = sr.StockReceiptID 
				INNER JOIN stf.stock  s ON s.StockID = sr.StockID 
				INNER join STC.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				LEFT JOIN  acc.DL d ON d.DLID = sr.DeliverDlID
				LEFT JOIN  stf.stock  ds ON ds.StockID = sr.DeliverStockID   
				INNER JOIN CFG.[User] AS u ON u.UserID = sr.Creator 
				INNER JOIN CFG.[User] AS u2 ON u2.UserID = sr.LastEditor
				INNER JOIN #vwStockDocumentsAccess AS vsda ON vsda.StockDocumentTypeID = sdtb.StockDocumentTypeID
				INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = sr.StockID
				LEFT JOIN  #vwVoucherPrevoucher v on v.PrevoucherID = sr.PrevoucherID 
				WHERE     (sr.FinancialPeriodID = @FinancialPeriodID)
				AND sdt.[DocumentType] <> 7
				AND (@IsAmountList = 0 OR sdt.[DocumentType] NOT IN (3,11))
				AND 
				(
					(@IsAmountList = 1 
					and(@UserID = -1 
						or (@AmountViewRelatedToUser is not null and sr.Creator = @UserID)
						or (@AmountViewRelatedToOthersUserId IS NOT NULL AND sr.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@AmountViewRelatedToOthers) AS rfcst))
					))
					OR
					(@IsAmountList = 0 
					and(@UserID = -1 
						or (@QuantityViewRelatedToUser is not null and sr.Creator = @UserID)
						or (@QuantityViewRelatedToOthersUserId IS NOT NULL AND  sr.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@QuantityViewRelatedToOthers) AS rfcst))
					))																						
				)
			)T
		)
		';

	PRINT @Query;
	DECLARE @selectQuery NVARCHAR(MAX);

	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = '';
	ELSE
		SET @Filter = 'Where (' + @Filter + ')';

	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);

	SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);

	PRINT SYSDATETIME();
	EXECUTE sp_executesql @Query,
						  N'
			@UserID						INT ,
			@DateType					TINYINT ,
			@DateFormat					VARCHAR(10) ,
			@Submit						NVARCHAR(100) ,
			@Voucher					NVARCHAR(100) ,
			@PreVoucher					NVARCHAR(100) ,
			@Produce					NVARCHAR(100) ,
			@Purchase					NVARCHAR(100) ,
			@Spoilages					NVARCHAR(100) ,
			@Trust						NVARCHAR(100) ,
			@Transfer					NVARCHAR(100) ,
			@Other						NVARCHAR(100) ,
			@StockRecounting			NVARCHAR(100) ,
			@AmountViewRelatedToUser	INT ,
			@AmountViewRelatedToOthers	NVARCHAR(MAX) ,
			@QuantityViewRelatedToUser	INT ,
			@QuantityViewRelatedToOthers NVARCHAR(MAX) ,
			@FirstInventory				NVARCHAR(100),
			@FinancialPeriodID INT ,
			@IsAmountList BIT ,
			@withoutBase NVARCHAR(100) , 
			@Proposal		 NVARCHAR(100) , 
			@PurchaseRequest		 NVARCHAR(100),
			@JustificationInput		 NVARCHAR(100),
			@PurchaseInvoice		 NVARCHAR(100),
			@StockReceipt		     NVARCHAR(100),
			@DeliveryJustification	 NVARCHAR(100),
			@PurchaseContract  NVARCHAR(100),
			@Clearance NVARCHAR(100),
			@Contract NVARCHAR(100),
			@Outgoing NVARCHAR(100),
			@QuantityViewRelatedToOthersUserId INT,
			@AmountViewRelatedToOthersUserId INT,
			@TemporaryReceipt NVARCHAR(100),
			@ReturnRequest NVARCHAR(100),
			@CultureNo TINYINT,
			@ProductionPlanning NVARCHAR(100),
			@ProductionStatistic NVARCHAR(100)
		',
		@UserID = @UserID,
		@DateType = @DateType,
		@DateFormat = @DateFormat,
		@Submit = @Submit,
		@Voucher = @Voucher,
		@PreVoucher = @PreVoucher,
		@Produce = @Produce,
		@Purchase = @Purchase,
		@Spoilages = @Spoilages,
		@CultureNo = @CultureNo,
		@Trust = @Trust,
		@Transfer = @Transfer,
		@Other = @Other,
		@StockRecounting = @StockRecounting,
		@AmountViewRelatedToUser = @AmountViewRelatedToUser,
		@AmountViewRelatedToOthers = @AmountViewRelatedToOthers,
		@QuantityViewRelatedToUser = @QuantityViewRelatedToUser,
		@QuantityViewRelatedToOthers = @QuantityViewRelatedToOthers,
		@FirstInventory = @FirstInventory,
		@FinancialPeriodID = @FinancialPeriodID,
		@IsAmountList = @IsAmountList,
		@Proposal = @Proposal,
		@withoutBase = @withoutBase,
		@PurchaseRequest = @PurchaseRequest,
		@JustificationInput = @JustificationInput,
		@PurchaseInvoice = @PurchaseInvoice,
		@StockReceipt = @StockReceipt,
		@DeliveryJustification = @DeliveryJustification,
		@PurchaseContract = @PurchaseContract,
		@Clearance = @Clearance,
		@Contract = @Contract,
		@Outgoing = @Outgoing,
		@QuantityViewRelatedToOthersUserId = @QuantityViewRelatedToOthersUserId,
		@AmountViewRelatedToOthersUserId = @AmountViewRelatedToOthersUserId,
		@TemporaryReceipt=@TemporaryReceipt ,
		@ReturnRequest=@ReturnRequest ,
		@ProductionPlanning=@ProductionPlanning ,
		@ProductionStatistic=@ProductionStatistic ;

	PRINT SYSDATETIME();
	DECLARE @Count INT;

	EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

	SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
	EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

	RETURN ISNULL(@Count, 0);
END;
