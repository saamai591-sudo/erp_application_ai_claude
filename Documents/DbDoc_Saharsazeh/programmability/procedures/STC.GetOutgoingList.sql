------------------------------------------------------------------------------------------------------------------
create   PROCEDURE [STC].GetOutgoingList
    (
        @FinancialPeriodID INT ,
        @IsAmountList INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN
        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Submit NVARCHAR(20) ,
                @Voucher NVARCHAR(100) ,
                @PreVoucher NVARCHAR(100) ,
                @Sale NVARCHAR(100) ,
                @Consume NVARCHAR(100) ,
                @Trust NVARCHAR(100) ,
                @Transfer NVARCHAR(100) ,
                @Spoilages NVARCHAR(100) ,
                @Other NVARCHAR(100) ,
                @StockRecounting NVARCHAR(100) ,
                @AmountViewRelatedToUser INT ,
                @AmountViewRelatedToOthers NVARCHAR(MAX) ,
                @AmountViewUnauthorizedUsers NVARCHAR(MAX) ,
                @QuantityViewRelatedToUser INT ,
                @QuantityViewRelatedToOthers NVARCHAR(MAX) ,
                @QuantityViewUnauthorizedUsers NVARCHAR(MAX) ,
				@CultureNo tinyint,
                @Asset NVARCHAR(100);

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = CFG.GetuserCulture();

        SET @UserID = CFG.GetuserID();

        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;
        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
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

        SELECT @Submit = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'Statuses'
               AND L.Item = 'Submit'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Voucher = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PreVoucherStatuses'
               AND L.Item = 'Voucher'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @PreVoucher = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PreVoucherStatuses'
               AND L.Item = 'PreVoucher'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Sale = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Sale'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Consume = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Consume'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Trust = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Trust'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Transfer = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Transfer'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Spoilages = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Spoilages'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Other = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Other'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @StockRecounting = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'StockRecounting'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Asset = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingTypes'
               AND L.Item = 'Asset'
               AND LV.Culture = CFG.GetuserCulture();

        --AmountOutgoing
        SELECT @AmountViewRelatedToUser = UserID
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'AmountOutgoing'
			   AND AccessKey = 'ViewRelatedToUser'
			   AND UserID = @UserID
	
		SELECT @AmountViewRelatedToOthers = UserID ,
               @AmountViewUnauthorizedUsers = Users
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'AmountOutgoing'
			   AND AccessKey = 'ViewRelatedToOthers'
			   AND UserID = @UserID

        --QuantityOutgoing
        SELECT @QuantityViewRelatedToUser = UserID
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'QuantityOutgoing'
			   AND AccessKey = 'ViewRelatedToUser'
			   AND UserID = @UserID
	
		SELECT @QuantityViewRelatedToOthers = UserID,
               @QuantityViewUnauthorizedUsers = Users
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'QuantityOutgoing'
			   AND AccessKey = 'ViewRelatedToOthers'
			   AND UserID = @UserID

        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';

        DECLARE @WithOutbase NVARCHAR(100) ,
                @Justification NVARCHAR(100) ,
                @Quotation NVARCHAR(100) ,
                @Remittance NVARCHAR(100) ,
                @Invoice NVARCHAR(100) ,                
                @SaleContract NVARCHAR(100) ,           
                @TransferRequest NVARCHAR(100) ,
                @TemporaryOutgoing NVARCHAR(100) ,
                @Reception NVARCHAR(100) ,
                @StuffRequest NVARCHAR(100);


        SELECT @WithOutbase = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'WithOutbase'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Justification = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Justification'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Quotation = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Quotation'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Remittance = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Remittance'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Invoice = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Invoice'
               AND LV.Culture = CFG.GetuserCulture();
        SELECT @SaleContract = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'SaleContract'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @TransferRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingBaseTypes'
               AND L.Item = 'TransferRequest'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @TemporaryOutgoing = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'OutgoingBaseTypes'
               AND L.Item = 'TemporaryOutgoing'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Reception = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Reception'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @StuffRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'DocumentNumTypes'
               AND L.Item = 'StuffRequest'
               AND LV.Culture = CFG.GetuserCulture();


			   select * into #vwStockAccess
			   from cfg.vwStockAccess

			   select * into #vwStockDocumentsAccess
			   from cfg.vwStockDocumentsAccess



        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
			
				select *
				into #Voucher
				from acc.vwVoucherPrevoucher
				where engname = ''Outgoing''
				and FinancialPeriodID = @FinancialPeriodID

	    ;WITH Query_Result 
			(
				OutgoingID ,
				AutoGenerated,
				[Type], 
				StockDocumentTypeBaseEntityID,
				StockDocumentTypeTitle,
				BaseEntity ,
				Number,
				[Date] , 
				StockID ,
				DeliverDlID,
				DeliverStockID,
				TotalPrice,
				FinancialPeriodID,
				PreVoucherID,
				[Version],
				Creator,
				CreationDate,
				StockCode,
				StockName,
				StockName2,
				DeliverDlCode,
				DeliverDlName,
				DeliverDlName2,
				Date_Date,
				CreateDateString ,
				EditionDateString,
				CreatorUserName,
				EditorName,
				VoucherID,
				VoucherNumber,
				VoucherDate ,
				Date_VoucherDate ,
				TypeName,
				TypeName2,
				LastEditionDate,
				StateString,
				BaseEntityTitle
			)
			As 
			(
				SELECT  *,
						CAST( CASE WHEN T.VoucherID IS not null  THEN @Voucher
						WHEN T.PreVoucherID IS not null  THEN @PreVoucher
						ELSE @Submit  END AS NVARCHAR(512))AS StateString,
						CASE  T.BaseEntity
							WHEN 2 THEN @StuffRequest
							WHEN 3 THEN @Justification
							WHEN 4 THEN @Quotation
							WHEN 5 THEN @Remittance
							WHEN 6 THEN @Invoice
							WHEN 7 THEN @TemporaryOutgoing
							WHEN 8 THEN @Reception
							WHEN 9 THEN @SaleContract
                            WHEN 10 THEN @TransferRequest
							else @WithOutbase END as BaseEntityTitle

				FROM (
				SELECT     OutgoingID, 
						   o.AutoGenerated, 
						   sdt.[DocumentType],
						   o.StockDocumentTypeBaseEntityID, 
						   case @CultureNo
								when 1 then sdt.Title
								when 2 then sdt.Title2
							end as StockDocumentTypeTitle ,
						   sdtb.BaseEntity,
						   o.Number, 
						   o.[Date], 
						   s.StockID, 
						   DeliverDlID, 
						   DeliverStockID, 
						   TotalPrice, 
						   o.FinancialPeriodID, 
						   o.PreVoucherID, 
						   o.[Version], 
						   o.Creator, 
						   o.CreationDate,
						   s.Code StockCode,
						   s.Title StockName,
						   s.Title2 StockName2,
						   CASE WHEN o.DeliverDlID IS NOT NULL THEN d.code ELSE cast(ds.Code as NVARCHAR(256)) END AS DeliverDlCode,
						   CASE WHEN o.DeliverDlID IS NOT NULL THEN d.Title ELSE ds.Title END AS DeliverDlName,
						   CASE WHEN o.DeliverDlID IS NOT NULL THEN d.Title2 ELSE ds.Title2 END AS DeliverDlName2,
						   CFG.GetCLRSaturnDate(o.[Date], @DateFormat  , 0, @DateType) AS Date_Date, 
						   CFG.GetCLRSaturnDate(o.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
						   CFG.GetCLRSaturnDate(o.LastEditionDate, @DateFormat  , 1, @DateType) AS EditionDateString,
						   u.Name AS CreatorUserName, 
						   u2.Name AS EditorName,
						   v.VoucherID AS VoucherID,
						   v.ReferenceNumber AS VoucherNumber,
						   v.Date VoucherDate,
						   CFG.GetCLRSaturnDate(v.Date,  @DateFormat  ,0, @DateType) AS Date_VoucherDate,
						   sdt.Title TypeName,
						   sdt.Title2 TypeName2,
						   o.LastEditionDate
					FROM STC.Outgoing  o 
                    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                        ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					INNER JOIN  stf.stock  s ON s.StockID = o.StockID 
					join STC.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					LEFT JOIN acc.DL d ON d.DLID = o.DeliverDlID
					LEFT JOIN  stf.stock  ds ON ds.StockID = o.DeliverStockID   
					INNER JOIN CFG.[User] AS u ON u.UserID = o.Creator 
					INNER JOIN  CFG.[User] AS u2 ON u2.UserID = o.LastEditor 
					INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
					INNER JOIN #vwStockDocumentsAccess AS vsda ON vsda.StockDocumentTypeID = sdtb.StockDocumentTypeID
					left join #Voucher v on v.PrevoucherID = o.PrevoucherID 
					WHERE (o.FinancialPeriodID = @FinancialPeriodID)
						AND (@IsAmountList = 0 OR sdt.DocumentType NOT IN (10,11,18))
						AND 
						(
							(@IsAmountList = 1 
								and(@UserID = -1 
								    or (@AmountViewRelatedToUser is not null and o.Creator = @UserID)
								    or (@AmountViewRelatedToOthers IS NOT NULL AND o.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@AmountViewUnauthorizedUsers) AS rfcst)))
                        )
						OR
								(@IsAmountList = 0 
								and(@UserID = -1 
								or (@QuantityViewRelatedToUser is not null and o.Creator = @UserID)
								or (@QuantityViewRelatedToOthers IS NOT NULL AND o.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@QuantityViewUnauthorizedUsers) AS rfcst))))																						
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



        SET @Query = CFG.ApplyPaging(
                         @tableName ,
                         @Query ,
                         @PageNumber ,
                         @RowspPage ,
                         @Filter ,
                         @Sort);
        --PRINT @Query

        EXECUTE sp_executesql @Query ,
        N'
		@UserID						 INT,
		@DateType 					 TINYINT,
		@DateFormat 				 VARCHAR(10),
		@Submit 					 NVARCHAR(20),
		@Voucher 					 NVARCHAR(100),
		@PreVoucher 				 NVARCHAR(100),
		@Sale 						 NVARCHAR(100),
		@Consume					 NVARCHAR(100),
		@Trust						 NVARCHAR(100),
		@Transfer					 NVARCHAR(100),
		@Spoilages					 NVARCHAR(100),
		@Other						 NVARCHAR(100),
		@StockRecounting			 NVARCHAR(100),
		@WithOutbase					nvarchar(100),
		@Justification					nvarchar(100),
		@Quotation						nvarchar(100),
		@Remittance						nvarchar(100),
		@Invoice						nvarchar(100),
		@SaleContract					nvarchar(100),
        @TransferRequest					nvarchar(100),
		@TemporaryOutgoing   			nvarchar(100),
		@Reception						nvarchar(100),
		@StuffRequest					nvarchar(100),
		@AmountViewRelatedToUser	 INT,
		@AmountViewRelatedToOthers	 NVARCHAR(MAX),
		@AmountViewUnauthorizedUsers	 NVARCHAR(MAX),
		@QuantityViewRelatedToUser	 INT,
		@QuantityViewRelatedToOthers NVARCHAR(MAX),
		@QuantityViewUnauthorizedUsers NVARCHAR(MAX),
		@Asset						 NVARCHAR(100),
		@FinancialPeriodID           INT ,
		@CultureNo					 TINYINT,
		@IsAmountList                INT 
	    ' ,
        @UserID = @UserID ,
        @DateType = @DateType ,
        @DateFormat = @DateFormat ,
        @Submit = @Submit ,
        @Voucher = @Voucher ,
        @PreVoucher = @PreVoucher ,
        @Sale = @Sale ,
        @Consume = @Consume ,
        @Trust = @Trust ,
        @Transfer = @Transfer ,
        @Spoilages = @Spoilages ,
        @Other = @Other ,
        @StockRecounting = @StockRecounting ,
        @AmountViewRelatedToUser = @AmountViewRelatedToUser ,
        @AmountViewRelatedToOthers = @AmountViewRelatedToOthers ,
        @AmountViewUnauthorizedUsers = @AmountViewUnauthorizedUsers ,
        @QuantityViewRelatedToUser = @QuantityViewRelatedToUser ,
        @QuantityViewRelatedToOthers = @QuantityViewRelatedToOthers ,
        @QuantityViewUnauthorizedUsers = @QuantityViewUnauthorizedUsers ,
        @WithOutbase = @WithOutbase ,
        @Justification = @Justification ,
        @Quotation = @Quotation ,
        @Remittance = @Remittance ,
        @Invoice = @Invoice ,
        @SaleContract = @SaleContract ,
        @TransferRequest= @TransferRequest,
        @TemporaryOutgoing = @TemporaryOutgoing ,
        @Reception = @Reception ,
        @StuffRequest = @StuffRequest ,
        @Asset = @Asset ,
        @FinancialPeriodID = @FinancialPeriodID ,
		@CultureNo = @CultureNo ,
        @IsAmountList = @IsAmountList;

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);

    END;

