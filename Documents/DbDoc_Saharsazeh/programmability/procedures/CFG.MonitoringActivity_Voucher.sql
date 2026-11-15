-------------------------------------
CREATE   PROCEDURE [CFG].MonitoringActivity_Voucher
(
    @FinancialPeriod INT ,
    @DocumentNumTypes NVARCHAR(MAX)
)
--WITH ENCRYPTION 

AS
    BEGIN

        SELECT  *
        INTO    #DocumentNumType
        FROM    [CFG].[Split](@DocumentNumTypes, ',');
        

        CREATE TABLE #VoucherPrevoucher
        (PrevoucherID BIGINT NOT NULL)


		INSERT INTO      #VoucherPrevoucher
        SELECT  PrevoucherID
        FROM    ACC.VoucherPrevoucher vp
        JOIN acc.Voucher AS v ON v.VoucherID = vp.VoucherID
        WHERE v.FinancialPeriodID = @FinancialPeriod
        GROUP BY PrevoucherID;
        
        -----Record Level Access
        
        
        SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba
        WHERE vba.UserID = cfg.GetuserID()
        
        SELECT * INTO #vwStockAccess
        FROM cfg.vwStockAccess AS vsa
        WHERE vsa.UserID = cfg.GetuserID()
        
        
        
        

        CREATE TABLE #OperationLevelAccessUser ( userid INT );

        CREATE TABLE #MonitoringActivityVoucher
            (
              FormEngName VARCHAR(MAX) ,
              Title NVARCHAR(MAX) ,
              ID INT ,
              Number NVARCHAR(MAX) ,
              [Date] VARCHAR(MAX) ,
              BranchCode INT null,
              BranchTitle NVARCHAR(MAX) null,
              Creator NVARCHAR(MAX) ,
              LaseEditor NVARCHAR(MAX) ,
              [Status] NVARCHAR(MAX) ,
              PreVoucherID INT ,
              DocumentNumType NVARCHAR(MAX) ,
              SystemName NVARCHAR(MAX) ,
              Amount DECIMAL(30, 4) ,
              DlCode VARCHAR(250) null,
              DlTitle NVARCHAR(MAX) null,
              DocumentTypeTitle NVARCHAR(MAX)              
            );

        DECLARE @Culture VARCHAR(25) ,
            @CurrentUser INT ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @UnauthorizedUsers NVARCHAR(MAX) ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @TranslationVoucher VARCHAR(10) ,
            @LocalizeEnumValue NVARCHAR(1024) ,
            @LocalizeEnumValue1 NVARCHAR(1024),
			@BaseCurrencyPrecision int,
			@CultureNo tinyint,
			@Submit NVARCHAR(10),
            @PreVoucher NVARCHAR(25),
			@Stock nvarchar(10),
			@Sale nvarchar(10),
			@Vendors nvarchar(25),
			@Finance nvarchar(25), 
			@ReturnFromAssignment nvarchar(50),
			@General nvarchar(10),
			@ForeignOrder nvarchar(25),
			@AssetManager nvarchar(25),
			@Contract nvarchar(25)

	    set @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

        SELECT  @TranslationVoucher = ConfigValue
        FROM    CFG.Configuration
        WHERE   ConfigKey = 'TranslationBetweenStocksHasAccountingVoucher';


        SET @Culture = CFG.GetuserCulture();
        SET @CurrentUser = CFG.GetuserID();

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture

        SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @CurrentUser;
        IF @DateType IS NULL
            SET @DateType = CASE @Culture
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END;
		
        SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @CurrentUser;
		       
        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';

		SELECT @Submit = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'Statuses'
			   AND L.Item = 'Submit'
			   AND LV.Culture = @Culture;


		SELECT @PreVoucher = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'PreVoucherStatuses'
			   AND L.Item = 'PreVoucher'
			   AND LV.Culture = @Culture;

		SELECT @Stock = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'AddressTypes'
			   AND L.Item = 'Stock'
			   AND LV.Culture = @Culture;

		
		SELECT @Sale = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'AssetSaleTypes'
			   AND L.Item = 'Sale'
			   AND LV.Culture = @Culture;


		SELECT @Vendors = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'SaturnModules'
			   AND L.Item = 'VendorManager'
			   AND LV.Culture = @Culture;

		
		SELECT @Finance = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'SaturnModules'
			   AND L.Item = 'FinanceManager'
			   AND LV.Culture = @Culture;

		
		SELECT @ReturnFromAssignment = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'CheqeOperationTypeInReceive'
			   AND L.Item = 'ReturnFromAssignment'
			   AND LV.Culture = @Culture;

		
		SELECT @General = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'EMenuFormTypes'
			   AND L.Item = 'General'
			   AND LV.Culture = @Culture;

		
		SELECT @ForeignOrder = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'SaturnModules'
			   AND L.Item = 'ForeignOrder'
			   AND LV.Culture = @Culture;

		
		SELECT @AssetManager = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'SaturnModules'
			   AND L.Item = 'AssetManager'
			   AND LV.Culture = @Culture;

		SELECT @Contract = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'SaturnModules'
			   AND L.Item = 'Contract'
			   AND LV.Culture = @Culture;

       IF OBJECT_ID('stc.Outgoing') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'AmountOutgoing' )
            BEGIN

				select @LocalizeEnumValue = Value
				from MDT.VWEntityTranslate
				where name = 'Outgoing'
				and Culture = @Culture


				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null

                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountOutgoing'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountOutgoing'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

                INSERT  INTO #OperationLevelAccessUser 
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountOutgoing' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;
                
        SELECT o.OutgoingID
        INTO #NonPricedOutGoing
        FROM   STC.OutgoingItem oi
               JOIN stc.Outgoing AS o
                    ON  o.OutgoingID = oi.OutgoingID
        WHERE  Fee                       = 0
               AND FinancialPeriodID     = @FinancialPeriod
              


                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'AmountOutgoing' ,
                                @LocalizeEnumValue ,
                                o.OutgoingID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
								case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'Outgoing' ,
                                @Stock,
                                o.TotalPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
                                END,                                
                                case @CultureNo
										when 2 then sdt.Title2
										else sdt.Title
								end
                        FROM    STC.Outgoing o
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
								join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                                JOIN STF.Stock s ON s.StockID = o.StockID
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DeliverDlID
                                LEFT JOIN #NonPricedOutGoing npog ON o.OutgoingID = npog.OutgoingID 
								LEFT JOIN STF.Stock ds ON ds.StockID = o.DeliverStockID
                        WHERE   npog.OutgoingID IS NULL
                        AND 
                        ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                      OR ( @ViewRelatedToUser IS NOT NULL  AND o.Creator = @CurrentUser )
                                      OR ( @ViewRelatedToOthers IS not NULL
                                          and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                      )
                                )
                                AND sdt.DocumentType NOT IN (10,11,18)
                                AND ( DocumentType <> 4
                                      OR 
									  LOWER(@TranslationVoucher) = 'true' 
									  OR
									  ds.StockTypeID <> s.StockTypeID
									)
                                      
                                      ;
            END;
			
			
		--print sysdatetime()	--print 2
	
        IF OBJECT_ID('sle.Invoice') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Invoice' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'Invoice'
				and Culture = @Culture

                set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null

				SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Invoice'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Invoice'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser

                INSERT  INTO #OperationLevelAccessUser   
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Invoice' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;
                
                
				--print sysdatetime() --print 2.5
				
				DECLARE @InvoiceNeedConfirm NVARCHAR(10)
				
				 SELECT @InvoiceNeedConfirm = LOWER(ConfigValue)
				 FROM   CFG.Configuration s
				 WHERE  s.ConfigKey = 'InvoiceNeedConfirm'
				
				
				
				
                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Invoice' ,
                                @LocalizeEnumValue ,
                                InvoiceID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'Invoice' ,
                                @Sale,
                                o.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then st.Title2
										else st.Title
								end
                        FROM    SLE.Invoice o
                        join sle.SaleType AS st on st.SaleTypeID = o.SaleTypeID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.CustomerID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND (@InvoiceNeedConfirm = 'false' OR o.SaleInvoiceStatus = 2)
                                and o.SaleInvoiceStatus <> 5
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                      OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                      OR ( @ViewRelatedToOthers IS not NULL
                                          and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                      )
                                )
            END;

			--print sysdatetime()	--print 3


        IF OBJECT_ID('stc.ReturnedOutgoing') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'AmountReturnedOutgoing' )
            BEGIN
				
				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReturnedOutgoing'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountReturnedOutgoing'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountReturnedOutgoing'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
                SELECT rfcs.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountReturnedOutgoing' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcs                      
                
                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'AmountReturnedOutgoing' ,
                                @LocalizeEnumValue ,
                                ReturnedOutgoingID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReturnedOutgoing' ,
                                @Stock,
                                o.TotalPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then sdt.Title2
										else sdt.Title
								end
									
                        FROM    STC.ReturnedOutgoing o
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        join stc.StockDocumentType AS sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                                JOIN STF.Stock s ON s.StockID = o.StockID
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DlDeliverID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                      OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                      OR ( @ViewRelatedToOthers IS not NULL
                                          and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                      )
                                    )
                                AND o.ReturnedOutgoingID NOT IN (
                                SELECT  ReturnedOutgoingID
                                FROM    STC.ReturnedOutgoingItem
                                WHERE  Fee = 0 );
            END;

			--print sysdatetime()	--print 4


        IF OBJECT_ID('sle.ReturnedSaleInvoice') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReturnedSaleInvoice' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReturnedSaleInvoice'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null

                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnedSaleInvoice'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnedSaleInvoice'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReturnedSaleInvoice' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReturnedSaleInvoice' ,
                                @LocalizeEnumValue ,
                                ReturnedSaleInvoiceID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReturnedSaleInvoice' ,
                                @Sale,
                                o.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then st.Title2
										else st.Title
								end
                        FROM    SLE.ReturnedSaleInvoice o
                        join sle.SaleType AS st on st.SaleTypeID = o.SaleTypeID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.CustomerID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 5


        IF OBJECT_ID('stc.StockReceipt') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'AmountReceipt' )
            BEGIN


				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'StockReceipt'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountReceipt'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountReceipt'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountReceipt' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;
                
                
                  SELECT sr.StockReceiptID
                  INTO   #NonPriceStockReceipt
                  FROM   STC.StockReceiptItem sri
                         JOIN stc.StockReceipt AS sr
                              ON  sr.StockReceiptID = sri.StockReceiptID
                  WHERE  Fee = 0
                         AND EstimatedFee = 0
                         AND FinancialPeriodID = @FinancialPeriod
                         AND sr.PreVoucherID IS NULL
                  GROUP BY
                         sr.StockReceiptID
                         
                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'AmountReceipt' ,
                                @LocalizeEnumValue ,
                                sr.StockReceiptID ,
                                Number ,
                                CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN sr.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                sr.PreVoucherID ,
                                'StockReceipt' ,
                                @Stock,
                                sr.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then sdt.Title
										else sdt.Title2
								END DocumentTypeTitle
                        FROM    STC.StockReceipt sr
                        JOIN STC.StockDocumentTypeBaseEntity sdtb
                            ON sdtb.StockDocumentTypeBaseEntityID = sr.StockDocumentTypeBaseEntityID
                        JOIN STC.StockDocumentType sdt
                            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                        JOIN STF.Stock s ON s.StockID = sr.StockID
                        JOIN CFG.Branch b ON b.BranchID = s.BranchID
                        JOIN CFG.[User] u1 ON sr.Creator = u1.UserID
                        JOIN CFG.[User] u2 ON sr.LastEditor = u2.UserID
                        LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = sr.PreVoucherID
                        LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = sr.Creator
                        JOIN #vwStockAccess AS vsa ON vsa.StockID = sr.StockID
                        LEFT JOIN ACC.DL d ON d.DLID = sr.DeliverDlID
                        LEFT JOIN #NonPriceStockReceipt npsr ON sr.StockReceiptID = npsr.StockReceiptID
						LEFt JOIN STF.Stock ds ON ds.StockID = sr.DeliverStockID
                        WHERE   ( sr.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND DocumentType NOT IN ( 3, 7,11)
								and (DocumentType <> 5 or LOWER(@TranslationVoucher) = 'true' or ds.StockTypeID <> s.StockTypeID)
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                      OR ( @ViewRelatedToUser IS NOT NULL AND sr.Creator = @CurrentUser  )
                                      OR ( @ViewRelatedToOthers IS not NULL
                                          and sr.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                      )
                                    )
                                AND npsr.StockReceiptID IS NULL 
                                ;
            END;
			--print sysdatetime()	--print 6

        IF OBJECT_ID('VND.PurchaseInvoice') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PurchaseInvoice' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'PurchaseInvoice'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PurchaseInvoice'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PurchaseInvoice'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PurchaseInvoice' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

				select  PurchaseInvoiceID,	
						Number,		
						[Date],			
						PreVoucherID,	   
						TotalNetPrice,
						BranchID,
						DlID,
                        u1.Name Creator,
                        u2.Name LastEditor,
                        o.[Type]
						into #PurchaseInvoice
				FROM    VND.PurchaseInvoice o
                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
				LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
				where  FinancialPeriodID = @FinancialPeriod
					AND ( @CurrentUser = -1
                        OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                        OR ( @ViewRelatedToOthers IS not NULL
                            and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                        )
                    )

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PurchaseInvoice' ,
                                @LocalizeEnumValue ,
                                PurchaseInvoiceID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                o.Creator ,
                                o.LastEditor ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PurchaseInvoice' ,
                                @Vendors,
                                o.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then pt.Title2
										else pt.Title
								end
                        FROM    #PurchaseInvoice o
                        join vnd.PurchaseType AS pt on o.Type = pt.PurchaseTypeID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID                                
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DlID
                        WHERE   ( o.PreVoucherID IS NULL OR v.PrevoucherID IS NULL)     
            END;

        IF OBJECT_ID('VND.ConfirmPurchaseInvoice') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ConfirmPurchaseInvoice' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ConfirmPurchaseInvoice'
				and Culture = @Culture


				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ConfirmPurchaseInvoice'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ConfirmPurchaseInvoice'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ConfirmPurchaseInvoice' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

				select  ConfirmPurchaseInvoiceID,	
						o.Number,		
						o.[Date],			
						o.PreVoucherID,	   
						TotalNetPrice,
						BranchID,
						DlID,
                        u1.Name Creator,
                        u2.Name LastEditor,
                        p.[Type]
						into #ConfirmPurchaseInvoice
				FROM    VND.ConfirmPurchaseInvoice o
				join vnd.PurchaseInvoice p on p.PurchaseInvoiceID = o.PurchaseInvoiceID
                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
				LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
				where  o.FinancialPeriodID = @FinancialPeriod
					AND ( @CurrentUser = -1
                        OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                        OR ( @ViewRelatedToOthers IS not NULL
                            and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                        )
                    )

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ConfirmPurchaseInvoice' ,
                                @LocalizeEnumValue,
                                ConfirmPurchaseInvoiceID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,@DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                o.Creator ,
                                o.LastEditor ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PurchaseInvoice' ,
                                @Vendors,
                                o.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then pt.Title2
										else pt.Title
								end
                        FROM    #ConfirmPurchaseInvoice o
                        join vnd.PurchaseType AS pt on o.Type = pt.PurchaseTypeID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID                                
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DlID
                        WHERE   ( o.PreVoucherID IS NULL OR v.PrevoucherID IS NULL)     
            END;


        IF OBJECT_ID('VND.ReturnInvoice') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReturnInvoice' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReturnInvoice'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnInvoice'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnInvoice'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReturnInvoice' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReturnInvoice' ,
                                @LocalizeEnumValue ,
                                ReturnInvoiceID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReturnInvoice' ,
                                @Vendors,
                                o.TotalNetPrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then pt.Title2
										else pt.Title
								end
                        FROM    VND.ReturnInvoice o
                        join vnd.PurchaseType AS pt on pt.PurchaseTypeID = o.[Type]
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DlID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )

            END;

			--print sysdatetime()	--print 8


        IF OBJECT_ID('stc.ReturnStockReceipt') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReturnAmountReceipt' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReturnStockReceipt'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnAmountReceipt'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReturnAmountReceipt'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReturnAmountReceipt' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReturnAmountReceipt' ,
                                @LocalizeEnumValue ,
                                ReturnStockReceiptID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReturnStockReceipt' ,
                                @Stock,
                                o.TotalInvoicePrice ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								end,
                                case @CultureNo
										when 2 then sdt.Title2
										else sdt.Title
								end
                        FROM    STC.ReturnStockReceipt o
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                                JOIN STF.Stock s ON s.StockID = o.StockID
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DeliverDlID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND DocumentType NOT IN ( 3 )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
                                AND o.ReturnStockReceiptID NOT IN (
                                SELECT  ReturnStockReceiptID
                                FROM    STC.ReturnStockReceiptItem
                                WHERE  Fee = 0 group by ReturnStockReceiptID );
            END;

			--print sysdatetime()	--print 9


        IF OBJECT_ID('FIN.ReceiveReceipt') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReceiveReceipt' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReceiveReceipt'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveReceipt'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveReceipt'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReceiveReceipt' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;                       

			select i.ReceiveReceiptID,
				   sum(i.ReceiptAmountInBaseCurrency) ReceiptAmountInBaseCurrency 
			into #ReceiveReceiptItems
			from (
					select a.ReceiveReceiptID,
						   case when c.IsBaseCurrencyBasis = 0 then
									round(a.Amount * a.CurrencyRate / c.ExchangeUnit,@BaseCurrencyPrecision)
								when c.IsBaseCurrencyBasis = 1 then
									round(a.Amount * c.ExchangeUnit / a.CurrencyRate,@BaseCurrencyPrecision)
						   end as ReceiptAmountInBaseCurrency		               
					from (
							select ReceiveReceiptID,CurrencyID,CurrencyRate,Amount from FIN.ReceivedBankDraft
							union all
							select ReceiveReceiptID,CurrencyID,CurrencyRate,Amount from FIN.ReceivedCheqe
							union all
							select ReceiveReceiptID,CurrencyID,CurrencyRate,Amount from FIN.ReceivedCash
						 ) a
					join CFG.Currency c on a.CurrencyID = c.CurrencyID
				 ) i
			group by i.ReceiveReceiptID


					SELECT  o.ReceiveReceiptID,
							u1.Name Creator,
                            u2.Name LastEditor,
							PreVoucherID,
							Number,[Date],o.PartyID,
							i.ReceiptAmountInBaseCurrency ReceiptAmountInBaseCurrency,BranchID
					into #ReceiveReceipt
					FROM    FIN.ReceiveReceipt o
					join #ReceiveReceiptItems i on o.ReceiveReceiptID = i.ReceiveReceiptID
                    JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                    JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                    LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
					where FinancialPeriodID = @FinancialPeriod
                    AND [Status] <> 1
                    AND ( @CurrentUser = -1
                        OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                        OR ( @ViewRelatedToOthers IS not NULL
                            and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                        )
                    )

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReceiveReceipt' ,
                                @LocalizeEnumValue ,
                                ReceiveReceiptID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                o.Creator ,
                                o.LastEditor ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiveReceipt' ,
                                @Finance,
                                o.ReceiptAmountInBaseCurrency ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,
								Null
                        FROM    #ReceiveReceipt o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                        WHERE   ( o.PreVoucherID IS NULL OR v.PrevoucherID IS NULL)
            END;

			--print sysdatetime()	--print 10


        IF OBJECT_ID('FIN.PaymentReceipt') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PaymentReceipt' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'PaymentReceipt'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentReceipt'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentReceipt'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PaymentReceipt' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

		select i.PaymentReceiptID,
				   sum(i.PaymentAmountInBaseCurrency) PaymentAmountInBaseCurrency 
			into #PaymentReceiptItems
			from (
				select a.PaymentReceiptID,
					   case when c.IsBaseCurrencyBasis = 0 then
								round(a.Amount * a.CurrencyRate / c.ExchangeUnit,@BaseCurrencyPrecision)
							when c.IsBaseCurrencyBasis = 1 then
								round(a.Amount * c.ExchangeUnit / a.CurrencyRate,@BaseCurrencyPrecision)
					   end as PaymentAmountInBaseCurrency		               
				from (select PaymentReceiptID,CurrencyID,CurrencyRate,Amount from FIN.PaymentBankDraft
					  union all
					  select PaymentReceiptID,CurrencyID,CurrencyRate,Amount from FIN.PaymentCheqe
					  union all
					  select PaymentReceiptID,c.CurrencyID,c.CurrencyRate,c.Amount from FIN.PaymentOtherCheqe o
					  join FIN.ReceivedCheqe c on o.ReceivedCheqeID = c.ReceivedCheqeID
					  union all
					  select PaymentReceiptID,CurrencyID,CurrencyRate,Amount from FIN.PaymentCash
					 ) a
				join CFG.Currency c on a.CurrencyID = c.CurrencyID
			) i
			group by i.PaymentReceiptID


				SELECT  o.PaymentReceiptID,
						u1.Name Creator,
                        u2.Name LastEditor,
						PreVoucherID,
						[Date],
						Number,
						i.PaymentAmountInBaseCurrency PaymentAmountInBaseCurrency,
						BranchID,
						o.PartyID
					INTO #PaymentReceipt
				FROM    FIN.PaymentReceipt o
				join #PaymentReceiptItems i on o.PaymentReceiptID = i.PaymentReceiptID
                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
				WHERE  FinancialPeriodID = @FinancialPeriod
                AND [Status] = 0
                AND ( @CurrentUser = -1
                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                    OR ( @ViewRelatedToOthers IS not NULL
                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                    )
                )

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PaymentReceipt' ,
                                @LocalizeEnumValue ,
                                PaymentReceiptID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                O.Creator ,
                                O.LastEditor ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PaymentReceipt' ,
                                @Finance,
                                o.PaymentAmountInBaseCurrency ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
                                END
                                ,Null
                        FROM    #PaymentReceipt o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                        WHERE   ( o.PreVoucherID IS NULL OR v.PrevoucherID IS NULL)
            END;

			--print sysdatetime()	--print 11

        IF OBJECT_ID('stc.RevisionCost') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'RevisionCost' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'RevisionCost'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'RevisionCost'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'RevisionCost'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'RevisionCost' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

				declare @TranslationBetweenStocksHasAccountingVoucher bit
				select @TranslationBetweenStocksHasAccountingVoucher = case ConfigValue when 'False' then 0 else 1 end
				 from cfg.Configuration 
				 where Configkey = 'TranslationBetweenStocksHasAccountingVoucher'

		
				Select  h.RevisionCostID
				 into #IncludeRevisionCost
				from stc.RevisionCostItem i
				join stc.RevisionCost h on i.RevisionCostID = h.RevisionCostID
				left join stc.StockReceiptItem si on si.StockReceiptItemID = i.StockReceiptItemID
				left join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID			
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				left join stc.OutgoingItem oi on oi.OutgoingItemID = i.OutgoingItemID
				left join stc.Outgoing o on o.OutgoingID = oi.OutgoingID
				where h.FinancialPeriodID = @FinancialPeriod
				AND (s.StockReceiptID IS NULL or sdtb.StockDocumentTypeID <> 7)
				and (o.OutgoingID IS NULL OR (sdtb.StockDocumentTypeID <> 15))
				and (o.OutgoingID IS NULL OR (@TranslationBetweenStocksHasAccountingVoucher = 1 or sdtb.StockDocumentTypeID <> 13) )
				and (s.StockReceiptID IS NULL OR (@TranslationBetweenStocksHasAccountingVoucher = 1 or sdtb.StockDocumentTypeID <> 6) )
				group by h.RevisionCostID

				
				INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'RevisionCost' ,
                                @LocalizeEnumValue ,
                                o.RevisionCostID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'RevisionCost' ,
                                @Stock,
                                i.RevisionPrice ,
                                NULL ,
                                NULL,
                                Null
                        FROM    STC.RevisionCost o
						join #IncludeRevisionCost inc on inc.RevisionCostID = o.RevisionCostID
                                JOIN ( SELECT   RevisionCostID ,
                                                SUM(deference) RevisionPrice
                                       FROM     STC.RevisionCostItem
                                       GROUP BY RevisionCostID
                                     ) i ON i.RevisionCostID = o.RevisionCostID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
            
            --print sysdatetime()	--print 12

        IF OBJECT_ID('fin.ReceiveCommitment') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReceiveCommitment' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'ReceiveCommitment'
				and Culture = @Culture


				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveCommitment'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveCommitment'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReceiveCommitment' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

				select i.ReceiveCommitmentID,
					   sum(i.AmountInBaseCurrency) AmountInBaseCurrency 
				into #ReceiveCommitmentItems
				from (
						select a.ReceiveCommitmentID,
							   case when c.IsBaseCurrencyBasis = 0 then
										round(a.Amount * a.CurrencyRate / c.ExchangeUnit,@BaseCurrencyPrecision)
									when c.IsBaseCurrencyBasis = 1 then
										round(a.Amount * c.ExchangeUnit / a.CurrencyRate,@BaseCurrencyPrecision)
							   end as AmountInBaseCurrency		               
						from (
								select ReceiveCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.ReceiveCheqeCommitment
								union all
								select ReceiveCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.ReceivePromissoryCommitment
								union all
								select ReceiveCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.ReceiveGuarantyCommitment
							 ) a
						join CFG.Currency c on a.CurrencyID = c.CurrencyID
					 ) i
				group by i.ReceiveCommitmentID

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReceiveCommitment' ,
                                @LocalizeEnumValue ,
                                o.ReceiveCommitmentID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiveCommitment' ,
                                @Finance,
                                i.AmountInBaseCurrency AmountInBaseCurrency ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,
								Null
                        FROM    FIN.ReceiveCommitment o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
								join #ReceiveCommitmentItems i on o.ReceiveCommitmentID = i.ReceiveCommitmentID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND [Status] <> 1
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 13

        IF OBJECT_ID('fin.PaymentCommitment') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PaymentCommitment' )
            BEGIN

				select @LocalizeEnumValue = Value
				from  MDT.VWEntityTranslate
				where name = 'PaymentCommitment'
				and Culture = @Culture

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCommitment'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCommitment'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
                SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PaymentCommitment' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;


		select i.PaymentCommitmentID,
				   sum(i.AmountInBaseCurrency) AmountInBaseCurrency 
			into #PaymentCommitmentItems
			from (
					select a.PaymentCommitmentID,
						   case when c.IsBaseCurrencyBasis = 0 then
									round(a.Amount * a.CurrencyRate / c.ExchangeUnit,@BaseCurrencyPrecision)
								when c.IsBaseCurrencyBasis = 1 then
									round(a.Amount * c.ExchangeUnit / a.CurrencyRate,@BaseCurrencyPrecision)
						   end as AmountInBaseCurrency		               
					from (
							select PaymentCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.PaymentCheqeCommitment
							union all
							select PaymentCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.PaymentPromissoryCommitment
							union all
							select PaymentCommitmentID,CurrencyID,CurrencyRate,Amount from FIN.PaymentGuarantyCommitment
						 ) a
					join CFG.Currency c on a.CurrencyID = c.CurrencyID
				 ) i
			group by i.PaymentCommitmentID

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PaymentCommitment' ,
                                @LocalizeEnumValue ,
                                o.PaymentCommitmentID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PaymentCommitment' ,
                                @Finance,
                                i.AmountInBaseCurrency  AmountInBaseCurrency ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.PaymentCommitment o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
								join #PaymentCommitmentItems i on o.PaymentCommitmentID = i.PaymentCommitmentID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND [Status] <> 1
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 14

        IF OBJECT_ID('fin.ReceiptCheqeFlow') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'BankOperation' )
            BEGIN
              
				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInReceive'
					   AND L.Item = 'AssignToBank'
					   AND LV.Culture = @Culture;

				SELECT @LocalizeEnumValue1 = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInReceive'
					   AND L.Item = 'CashAndProtest'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'BankOperation'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'BankOperation'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'BankOperation' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'BankOperation' ,
                                CASE WHEN o.Type = 0 THEN @LocalizeEnumValue
                                     WHEN o.Type = 5 THEN @LocalizeEnumValue1
									 WHEN o.Type = 10 THEN @ReturnFromAssignment
                                END ,
                                o.ReceiptCheqeFlowID ,
                                InnerNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiptCheqeFlow' ,
                                @Finance,
                                amount ,
                                NULL ,
                                NULL,Null
                        FROM    FIN.ReceiptCheqeFlow o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba  ON vba.BranchID = o.BranchID
                                LEFT JOIN ( SELECT  ReceiptCheqeFlowID ,
                                                    SUM(Amount) amount
                                            FROM    FIN.ReceiptCheqeFlowItem a
                                                    JOIN FIN.ReceivedCheqe b ON a.ReceivedCheqeID = b.ReceivedCheqeID
                                            GROUP BY ReceiptCheqeFlowID
                                          ) FI ON FI.ReceiptCheqeFlowID = o.ReceiptCheqeFlowID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND [Type] IN ( 0, 5 , 10)
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			--print sysdatetime()	--print 15

        IF OBJECT_ID('fin.ReceiptCheqeFlow') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'DrawBackReceivedCheqe' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInReceive'
					   AND L.Item = 'DrawBack'
					   AND LV.Culture = @Culture;

				SELECT @LocalizeEnumValue1 = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'CheqeOperationTypeInReceive'
				   AND L.Item = 'ReturnedOfSpend'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DrawBackReceivedCheqe'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DrawBackReceivedCheqe'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'DrawBackReceivedCheqe' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'DrawBackReceivedCheqe' ,
                                CASE WHEN o.Type = 1 THEN @LocalizeEnumValue
                                     WHEN o.Type = 4 THEN @LocalizeEnumValue1
                                END ,
                                o.ReceiptCheqeFlowID ,
                                InnerNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiptCheqeFlow' ,
                                @Finance,
                                amount ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.ReceiptCheqeFlow o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                                LEFT JOIN ( SELECT  ReceiptCheqeFlowID ,
                                                    SUM(Amount) amount
                                            FROM    FIN.ReceiptCheqeFlowItem a
                                                    JOIN FIN.ReceivedCheqe b ON a.ReceivedCheqeID = b.ReceivedCheqeID
                                            GROUP BY ReceiptCheqeFlowID
                                          ) FI ON FI.ReceiptCheqeFlowID = o.ReceiptCheqeFlowID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND o.[Type] IN ( 1, 4 )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			--print sysdatetime()	--print 16

        IF OBJECT_ID('fin.ReceiptCheqeFlow') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReceivedCheqeCashing' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInReceive'
					   AND L.Item = 'CashToBank'
					   AND LV.Culture = @Culture;

				SELECT @LocalizeEnumValue1 = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInReceive'
					   AND L.Item = 'CashToFund'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceivedCheqeCashing'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceivedCheqeCashing'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReceivedCheqeCashing' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReceivedCheqeCashing' ,
                                CASE WHEN o.Type = 2 THEN @LocalizeEnumValue
                                     WHEN o.Type = 3 THEN @LocalizeEnumValue1
                                END ,
                                o.ReceiptCheqeFlowID ,
                                InnerNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiptCheqeFlow' ,
                                @Finance,
                                amount ,
                                NULL ,
                                NULL,
                                Null
                        FROM    FIN.ReceiptCheqeFlow o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ( SELECT  ReceiptCheqeFlowID ,
                                                    SUM(Amount) amount
                                            FROM    FIN.ReceiptCheqeFlowItem a
                                                    JOIN FIN.ReceivedCheqe b ON a.ReceivedCheqeID = b.ReceivedCheqeID
                                            GROUP BY ReceiptCheqeFlowID
                                          ) FI ON FI.ReceiptCheqeFlowID = o.ReceiptCheqeFlowID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND [Type] IN ( 2, 3 )
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 17

        IF OBJECT_ID('fin.PaymentCheqeFlow') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PaymentCheqeCashing' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'CheqeOperationTypeInPayment'
					   AND L.Item = 'Cashing'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCheqeCashing'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCheqeCashing'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PaymentCheqeCashing' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 
		
		select  o.PaymentCheqeFlowID,
				u1.Name Creator,
                u2.Name LastEditor,
				InnerNumber,
				[Date],
				PreVoucherID,
				BranchID,
				amount
				into #PaymentCheqeFlow
		FROM    FIN.PaymentCheqeFlow o 
        JOIN CFG.[User] u1 ON o.Creator = u1.UserID
        JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID	
		LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator							
        LEFT JOIN ( SELECT  PaymentCheqeFlowID ,
                            SUM(Amount) amount
                    FROM    FIN.PaymentCheqeFlowItem a
                            JOIN FIN.PaymentCheqe b ON a.PaymentCheqeID = b.PaymentCheqeID
                    GROUP BY PaymentCheqeFlowID
                    ) FI ON FI.PaymentCheqeFlowID = o.PaymentCheqeFlowID
		where  FinancialPeriodID = @FinancialPeriod
		    AND [Type] = 0
		    AND ( @CurrentUser = -1
                OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                OR ( @ViewRelatedToOthers IS not NULL
                    and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                )
            )

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PaymentCheqeCashing' ,
                                @LocalizeEnumValue ,
                                o.PaymentCheqeFlowID ,
                                InnerNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                o.Creator ,
                                o.LastEditor ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PaymentCheqeFlow' ,
                                @Finance,
                                amount ,
                                NULL ,
                                NULL,
                                Null
                        FROM    #PaymentCheqeFlow o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                        WHERE   ( o.PreVoucherID IS NULL OR v.PrevoucherID IS NULL)                                                          
            END;

			--print sysdatetime()	--print 18
			
        IF OBJECT_ID('fin.PaymentCheqeFlow') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'DrawBackPaymentCheqe' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'CheqeOperationTypeInPayment'
				   AND L.Item = 'DrawBack'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DrawBackPaymentCheqe'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DrawBackPaymentCheqe'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'DrawBackPaymentCheqe' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'DrawBackPaymentCheqe' ,
                                @LocalizeEnumValue ,
                                o.PaymentCheqeFlowID ,
                                InnerNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PaymentCheqeFlow' ,
                                @Finance,
                                amount ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,
								Null
                        FROM    FIN.PaymentCheqeFlow o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN CFG.Party p ON p.PartyID = o.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                                LEFT JOIN ( SELECT  PaymentCheqeFlowID ,
                                                    SUM(Amount) amount
                                            FROM    FIN.PaymentCheqeFlowItem a
                                                    JOIN FIN.PaymentCheqe b ON a.PaymentCheqeID = b.PaymentCheqeID
                                            GROUP BY PaymentCheqeFlowID
                                          ) FI ON FI.PaymentCheqeFlowID = o.PaymentCheqeFlowID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND o.[Type] = 1
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 19

        IF OBJECT_ID('CFG.DebitCreditNote') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'DebitCreditNote' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'DebitCreditNote'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DebitCreditNote'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'DebitCreditNote'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'DebitCreditNote' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'DebitCreditNote' ,
                                @LocalizeEnumValue ,
                                o.DebitCreditNoteID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'DebitCreditNote' ,
                                @General,
                                i.amount ,
                                NULL ,
                                NULL,
                                Null
                        FROM    CFG.DebitCreditNote o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                join #vwBranchAccess AS vba on vba.BranchID = b.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
								join
								(
								select DebitCreditNoteID,sum(amount) amount
								from CFG.DebitCreditNoteitem
								where type = 0
								group by DebitCreditNoteID
								)i
									on i.DebitCreditNoteID = o.DebitCreditNoteID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                );

            END;

			--print sysdatetime()	--print 20

        IF OBJECT_ID('FIN.PettyCashCost') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PettyCashCost' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'PettyCashCost'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PettyCashCost'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PettyCashCost'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PettyCashCost' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  
                
                
                select pcc.PettyCashCostID, sum(Amount) Amount
                INTO #PettyCashCost
									from FIN.PettyCashCostItem pci
									JOIN fin.PettyCashCost AS pcc ON pcc.PettyCashCostID = pci.PettyCashCostID
                WHERE pcc.FinancialPeriodID = @FinancialPeriod
									group by pcc.PettyCashCostID
                
                

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PettyCashCost' ,
                                @LocalizeEnumValue ,
                                o.PettyCashCostID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PettyCashCost' ,
                                @Finance,
                                pcci.Amount,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.PettyCashCost o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN FIN.PettyCash pc ON pc.PettyCashID = o.PettyCashID
                                LEFT JOIN CFG.Party p ON p.PartyID = pc.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
								join #PettyCashCost pcci on o.PettyCashCostID = pcci.PettyCashCostID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 21

        IF OBJECT_ID('FIN.ReceiveCommitmentRecall') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ReceiveCommitmentRecall' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'ReceiveCommitmentRecall'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveCommitmentRecall'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ReceiveCommitmentRecall'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ReceiveCommitmentRecall' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  

				select o.ReceiveCommitmentRecallID into #ReceiveCommitmentRecall
				from fin.ReceiveCommitmentRecall o
				 LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID

				WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )

select SumItems.ReceiveCommitmentRecallID,Sum(Amount) Amount into #ReceiveCommitmentRecallSumItems from (
	select rcri.ReceiveCommitmentRecallID,sum(rcc.amount) Amount from fin.ReceiveCommitmentRecallItem rcri
	join #ReceiveCommitmentRecall rcr on rcri.ReceiveCommitmentRecallID = rcr.ReceiveCommitmentRecallID
	join fin.ReceiveCheqeCommitment rcc on rcri.ReceiveCheqeCommitmentID = rcc.ReceiveCheqeCommitmentID
	group by rcri.ReceiveCommitmentRecallID
	Union All
	select rcri.ReceiveCommitmentRecallID,sum(rgc.amount) Amount from fin.ReceiveCommitmentRecallItem rcri
	join #ReceiveCommitmentRecall rcr on rcri.ReceiveCommitmentRecallID = rcr.ReceiveCommitmentRecallID
	join fin.ReceiveGuarantyCommitment rgc on rcri.ReceiveGuarantyCommitmentID = rgc.ReceiveGuarantyCommitmentID
	group by rcri.ReceiveCommitmentRecallID
		Union All
	select rcri.ReceiveCommitmentRecallID,sum(rgc.amount) Amount from fin.ReceiveCommitmentRecallItem rcri
	join #ReceiveCommitmentRecall rcr on rcri.ReceiveCommitmentRecallID = rcr.ReceiveCommitmentRecallID
	join fin.ReceivePromissoryCommitment rgc on rcri.ReceivePromissoryCommitmentID = rgc.ReceivePromissoryCommitmentID
	group by rcri.ReceiveCommitmentRecallID
	) SumItems
	group by ReceiveCommitmentRecallID




                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ReceiveCommitmentRecall' ,
                                @LocalizeEnumValue ,
                                o.ReceiveCommitmentRecallID ,
                                NULL ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'ReceiveCommitmentRecall' ,
                                @Finance,
                                rcrsi.Amount ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.ReceiveCommitmentRecall o
						join #ReceiveCommitmentRecall a on o.ReceiveCommitmentRecallID = a.ReceiveCommitmentRecallID
						join #ReceiveCommitmentRecallSumItems rcrsi on a.ReceiveCommitmentRecallID = rcrsi.ReceiveCommitmentRecallID
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                               
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DLID
                       
            END;
            
            --print sysdatetime()	--print 22

        IF OBJECT_ID('FIN.PaymentCommitmentRecall') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'PaymentCommitmentRecall' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'PaymentCommitmentRecall'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCommitmentRecall'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'PaymentCommitmentRecall'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'PaymentCommitmentRecall' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;                      

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'PaymentCommitmentRecall' ,
                                @LocalizeEnumValue ,
                                PaymentCommitmentRecallID ,
                                NULL ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'PaymentCommitmentRecall' ,
                                @Finance,
                                0 ,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.PaymentCommitmentRecall o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                                LEFT JOIN ACC.DL d ON d.DLID = o.DLID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 23

        IF OBJECT_ID('FIN.GuarantyOperation') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'GuarantyOperation' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'GuarantyOperation'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'GuarantyOperation'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'GuarantyOperation'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'GuarantyOperation' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'GuarantyOperation' ,
                                @LocalizeEnumValue ,
                                GuarantyOperationID ,
                                o.Number ,
                                CFG.GetCLRSaturnDate(o.[date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'GuarantyOperation' ,
                                @Finance,
                                o.DeductedAmount ,
                                d.code,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FIN.GuarantyOperation o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
								left join fin.PaymentGuarantyCommitment p on p.PaymentGuarantyCommitmentID = o.PaymentGuarantyCommitmentID
								left join fin.PaymentCommitment ph on p.PaymentCommitmentID = ph.PaymentCommitmentID
								left join fin.ReceiveGuarantyCommitment r on r.ReceiveGuarantyCommitmentID = o.ReceiveGuarantyCommitmentID
								left join fin.ReceiveCommitment rc on rc.ReceiveCommitmentID = r.ReceiveCommitmentID
								left join cfg.party pa on pa.PartyID = ph.PartyID or pa.PartyID = rc.partyid
								left join acc.dl d on d.DLID = pa.DlID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND o.FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
								AND OperationType <> 1 ;
            END;
		
		--print sysdatetime()	--print 24
		
		IF OBJECT_ID('FOS.BillOfLading') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'BillOfLading' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
			    FROM   CFG.LocalizeEnum L
				       JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			    WHERE  L.Enum = 'DocumentNumTypes'
				       AND L.Item = 'BillOfLading'
				       AND LV.Culture = @Culture;
	
				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'BillOfLading'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'BillOfLading'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'BillOfLading' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'BillOfLading' ,
                                @LocalizeEnumValue ,
                                b.BillOfLadingID ,
                                b.BillNumber ,
                                CFG.GetCLRSaturnDate(b.[Date], @DateFormat, 0,@DateType) ,
                                br.Code ,
                                case @CultureNo
										when 2 then br.Title2
										else br.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN b.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                b.PreVoucherID ,
                                'BillOfLading' ,
                                @ForeignOrder,
                                isnull(pii.Price , 0),
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FOS.BillOfLading b
                                JOIN CFG.Branch br ON b.BranchID = br.BranchID
                                JOIN CFG.[User] u1 ON b.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON b.LastEditor = u2.UserID
								left join VND.PurchaseInvoiceItem pii on b.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = b.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = b.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = b.BranchID                                
                                JOIN CFG.Party p ON p.PartyID = b.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID								
                        WHERE   ( b.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND b.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and b.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
            
            --print sysdatetime()	--print 25

		IF OBJECT_ID('FOS.Clearance') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Clearance' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'Clearance'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Clearance'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Clearance'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Clearance' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Clearance' ,
                                @LocalizeEnumValue ,
                                c.ClearanceID ,
                                c.CotajNumber ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN c.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                c.PreVoucherID ,
                                'Clearance' ,
                                @ForeignOrder,
                                isnull(customsCost.Amount,0),
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FOS.Clearance c
                                JOIN CFG.Branch b ON b.BranchID = c.BranchID
                                JOIN CFG.[User] u1 ON c.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON c.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = c.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = c.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID                                
                                JOIN CFG.Party p ON p.PartyID = c.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID	
								left join(
								          select c.ClearanceID, sum(c.Amount) Amount
										  from FOS.ClearanceCustomsCost c
										  group by c.ClearanceID
								         ) customsCost on c.ClearanceID = customsCost.ClearanceID						
                        WHERE   ( c.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND c.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
            
            --print sysdatetime()	--print 26
		
		IF OBJECT_ID('FOS.CostOfOrder') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'CostOfOrder' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'CostOfOrder'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'CostOfOrder'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'CostOfOrder'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'CostOfOrder' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'CostOfOrder' ,
                                @LocalizeEnumValue ,
                                c.CostOfOrderID ,
                                Number ,
                                CFG.GetCLRSaturnDate([Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN c.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                c.PreVoucherID ,
                                'CostOfOrder' ,
                                @ForeignOrder,
                                items.Amount,
                                null,
                                null,Null
                        FROM    FOS.CostOfOrder c
                                JOIN CFG.Branch b ON b.BranchID = c.BranchID
                                JOIN CFG.[User] u1 ON c.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON c.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = c.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = c.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID    
								left join (
								            select i.CostOfOrderID, sum(i.Amount) Amount
											from FOS.CostOfOrderItem i
											group by i.CostOfOrderID
								          ) items on c.CostOfOrderID = items.CostOfOrderID                           
                        WHERE   ( c.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND c.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
		
		
		--print sysdatetime()	--print 27
		
		IF OBJECT_ID('FOS.LetterCredit') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'LetterCredit' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'LetterCredit'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'LetterCredit'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'LetterCredit'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'LetterCredit' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'LetterCredit' ,
                                @LocalizeEnumValue ,
                                l.LetterCreditID ,
                                l.LetterCreditNumber ,
                                CFG.GetCLRSaturnDate(l.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN l.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                l.PreVoucherID ,
                                'LetterCredit' ,
                                @ForeignOrder,
                                l.ProfitAmount,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FOS.LetterCredit l
                                JOIN CFG.Branch b ON b.BranchID = l.BranchID
                                JOIN CFG.[User] u1 ON l.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON l.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = l.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = l.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = l.BranchID                                
                                LEFT JOIN CFG.Party p ON p.PartyID = l.OpeningCreditBank
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID								
                        WHERE   ( l.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND l.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and l.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

		--print sysdatetime()	--print 28
		
		
		IF OBJECT_ID('FOS.OrderPricing') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'OrderPricing' )
            BEGIN


					SELECT @LocalizeEnumValue = LV.Value
				FROM   CFG.LocalizeEnum L
					   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
				WHERE  L.Enum = 'DocumentNumTypes'
					   AND L.Item = 'OrderPricing'
					   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'OrderPricing'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'OrderPricing'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'OrderPricing' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

		        select i.OrderPricingID,
		               i.ClearanceItemID,
		               max(r.Non) as MainCost,
		               (select sum(Share)
                        from FOS.OrderPricingItem i2
	                    where OrderPricingID = i.OrderPricingID and ClearanceItemID = i.ClearanceItemID) as Share									      
                into #OrderPricingItems
		        from FOS.OrderPricingItem i	
                join FOS.ClearanceItem ci on i.ClearanceItemID = ci.ClearanceItemID	
                join FOS.BillOfLadingItem b on ci.BillOfLadingItemID = b.BillOfLadingItemID	
                join VND.PurchaseInvoice_PriceRemains r on b.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID				
                group by i.OrderPricingID, i.ClearanceItemID


                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'OrderPricing' ,
                                @LocalizeEnumValue ,
                                o.OrderPricingID ,
                                o.Number ,
                                CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN o.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                o.PreVoucherID ,
                                'OrderPricing' ,
                                @ForeignOrder,
                                items.Amount,
                                null ,
                                null,Null
                        FROM    FOS.OrderPricing o
                                JOIN CFG.Branch b ON b.BranchID = o.BranchID
                                JOIN CFG.[User] u1 ON o.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON o.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = o.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = o.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = o.BranchID    
								left join (select i.OrderPricingID,
								                  sum(i.MainCost + i.Share) as Amount
								           from #OrderPricingItems i
										   group by i.OrderPricingID
								          ) items on o.OrderPricingID = items.OrderPricingID                                                            
                        WHERE   ( o.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND o.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and o.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			--print sysdatetime()	--print 29

		IF OBJECT_ID('FOS.Registration') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Registration' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Registration'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Registration'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Registration'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Registration' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Registration' ,
                                @LocalizeEnumValue ,
                                r.RegistrationID ,
                                r.RegistrationNumber ,
                                CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN r.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                r.PreVoucherID ,
                                'Registration' ,
                                @ForeignOrder,
                                r.WageAmount,
                                null,
                                null,Null
                        FROM    FOS.Registration r
                                JOIN CFG.Branch b ON b.BranchID = r.BranchID
                                JOIN CFG.[User] u1 ON r.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON r.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = r.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = r.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = r.BranchID                                
                        WHERE   ( r.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND r.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and r.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			
		IF OBJECT_ID('FOS.ShippingInsurance') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ShippingInsurance' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'ShippingInsurance'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ShippingInsurance'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ShippingInsurance'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ShippingInsurance' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ShippingInsurance' ,
                                @LocalizeEnumValue ,
                                s.ShippingInsuranceID ,
                                s.ShippingInsuranceNumber ,
                                CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN s.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                s.PreVoucherID ,
                                'ShippingInsurance' ,
                                @ForeignOrder,
                                pii.Price,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    FOS.ShippingInsurance s
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON s.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON s.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = s.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = s.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = s.BranchID                               
                                LEFT JOIN CFG.Party p ON p.PartyID = s.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID	
								join VND.PurchaseInvoiceItem pii on s.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID							
                        WHERE   ( s.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND s.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and s.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

		
			IF OBJECT_ID('AST.AssetReceipt') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'AssetReceipt' )
            BEGIN

				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'AssetReceipt'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountAssetReceipt'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountAssetReceipt'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountAssetReceipt' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'AssetReceipt' ,
                                @LocalizeEnumValue,
                                c.AssetReceiptID,
                                c.Number,
                                CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN c.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                c.PreVoucherID ,
                                'AssetReceipt',
                                @AssetManager,
                                c.BaseValue,
                                null ,
                                null,Null
                        FROM    AST.AssetReceipt c
                                JOIN CFG.Branch b ON b.BranchID = c.BranchID
                                JOIN CFG.[User] u1 ON c.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON c.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = c.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = c.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID                              
													
                        WHERE   ( c.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND c.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
								and c.Nature <> 1
            END;

			

			IF OBJECT_ID('AST.Insurance') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Insurance' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Insurance'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Insurance'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Insurance'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Insurance' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Insurance' ,
                                @LocalizeEnumValue ,
                                i.InsuranceID ,
                                i.Number ,
                                CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN i.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                i.PreVoucherID ,
                                'Insurance' ,
                                @AssetManager,
                                i.Price,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    AST.Insurance i
                                JOIN CFG.Branch b ON b.BranchID = i.BranchID
                                JOIN CFG.[User] u1 ON i.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON i.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = i.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = i.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID       
								join CFG.Party p on i.PartyID = p.PartyID
								left join ACC.DL d on p.DlID = d.DLID                       
                        WHERE   ( i.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND i.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and i.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

			
			IF OBJECT_ID('AST.Transfer') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Transfer' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Transfer'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountTransfer'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountTransfer'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountTransfer' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Transfer' ,
                                @LocalizeEnumValue ,
                                t.TransferID ,
                                t.Number ,
                                CFG.GetCLRSaturnDate(t.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN t.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                t.PreVoucherID ,
                                'Transfer' ,
                                @AssetManager,
                                0,
                                null ,
                                null,Null
                        FROM    AST.[Transfer] t
                                JOIN CFG.Branch b ON b.BranchID = t.SourceBranchID
                                JOIN CFG.[User] u1 ON t.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON t.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = t.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = t.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = t.SourceBranchID                                                              
                        WHERE   ( t.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND t.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and t.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

		
			IF OBJECT_ID('AST.Destruction') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Destruction' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Destruction'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountDestruction'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountDestruction'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountDestruction' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Destruction' ,
                                @LocalizeEnumValue ,
                                d.DestructionID ,
                                d.Number ,
                                CFG.GetCLRSaturnDate(d.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN d.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                d.PreVoucherID ,
                                'Destruction' ,
                                @AssetManager,
                                0,
                                null ,
                                null,Null
                        FROM    AST.Destruction d
                                JOIN CFG.Branch b ON b.BranchID = d.BranchID
                                JOIN CFG.[User] u1 ON d.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON d.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = d.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = d.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = d.BranchID                                                              						
                        WHERE   ( d.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND d.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and d.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
		
		
		IF OBJECT_ID('AST.ChangeCategory') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ChangeCategory' )
            BEGIN


					SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'ChangeCategory'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ChangeCategory'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ChangeCategory'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ChangeCategory' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ChangeCategory' ,
                                @LocalizeEnumValue ,
                                c.ChangeCategoryID ,
                                c.Number ,
                                CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN c.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                c.PreVoucherID ,
                                'ChangeCategory' ,
                                @AssetManager,
                                0,
                                null ,
                                null,Null
                        FROM    AST.ChangeCategory c
                                JOIN CFG.Branch b ON b.BranchID = c.BranchID
                                JOIN CFG.[User] u1 ON c.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON c.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = c.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = c.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID                               						
                        WHERE   ( c.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND c.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			
	
			IF OBJECT_ID('AST.Revaluation') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Revaluation' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Revaluation'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Revaluation'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Revaluation'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Revaluation' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Revaluation' ,
                                @LocalizeEnumValue ,
                                r.RevaluationID ,
                                r.Number ,
                                CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN r.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                r.PreVoucherID ,
                                'Revaluation' ,
                                @AssetManager,
                                0,
                                null ,
                                null,Null
                        FROM    AST.Revaluation r
                                JOIN CFG.Branch b ON b.BranchID = r.BranchID
                                JOIN CFG.[User] u1 ON r.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON r.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = r.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = r.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = r.BranchID                               						
                        WHERE   ( r.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND r.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and r.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			
		
			IF OBJECT_ID('AST.Sale') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Sale' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Sale'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountSale'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountSale'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountSale' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Sale' ,
                                @LocalizeEnumValue ,
                                s.SaleID ,
                                s.Number ,
                                CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN s.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                s.PreVoucherID ,
                                'Sale' ,
                                @AssetManager,
                                0,
                                d.Code ,
                                case @CultureNo
										when 2 then d.Title2
										else d.Title
								END,Null
                        FROM    AST.Sale s
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON s.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON s.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = s.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = s.Creator
                               JOIN #vwBranchAccess AS vba ON vba.BranchID = s.BranchID                               
                                LEFT JOIN CFG.Party p ON p.PartyID = s.PartyID
                                LEFT JOIN ACC.DL d ON d.DLID = p.DlID	
                        WHERE   ( s.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND s.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and s.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
		
			
			IF OBJECT_ID('AST.Salvage') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Salvage' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Salvage'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountSalvage'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'AmountSalvage'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'AmountSalvage' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Salvage' ,
                                @LocalizeEnumValue ,
                                s.SalvageID ,
                                s.Number ,
                                CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN s.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                s.PreVoucherID ,
                                'Salvage' ,
                                @AssetManager,
                                0,
                                null,
                                null,Null
                        FROM    AST.Salvage s
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON s.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON s.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = s.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = s.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = s.BranchID                                                        				
                        WHERE   ( s.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND s.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and s.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

		
			IF OBJECT_ID('AST.Repair') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Repair' )
            BEGIN

			    SELECT @LocalizeEnumValue = LV.Value
			    FROM   CFG.LocalizeEnum L
				       JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			    WHERE  L.Enum = 'DocumentNumTypes'
				       AND L.Item = 'Repair'
				       AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null	
                
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Repair'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Repair'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser  
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Repair' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;  

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Repair' ,
                                @LocalizeEnumValue ,
                                s.RepairID ,
                                s.Number ,
                                CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                Branch.Code ,
                                null ,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN s.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                s.PreVoucherID ,
                                'Repair' ,
                                @AssetManager,
                                0,
                                null ,
                                null,Null
                        FROM    AST.Repair s          
								join ast.asset a
									on a.assetid = s.assetid
								join cfg.Branch
									on Branch.BranchID = a.BranchID               
                                JOIN CFG.[User] u1 ON s.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON s.LastEditor = u2.UserID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = s.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = s.Creator                                							
                        WHERE   ( s.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND s.FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND s.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and s.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;

		
			IF OBJECT_ID('AST.Adjustment') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'Adjustment' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'DocumentNumTypes'
				   AND L.Item = 'Adjustment'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Adjustment'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'Adjustment'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser 
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'Adjustment' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst; 

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'Adjustment' ,
                                @LocalizeEnumValue ,
                                s.AdjustmentID ,
                                s.Number ,
                                CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0,
                                                     @DateType) ,
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN s.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                s.PreVoucherID ,
                                'Adjustment' ,
                                @AssetManager,
                                item.Amount,
                                null ,
                                null,Null
                        FROM    AST.Adjustment s
                                JOIN CFG.Branch b ON b.BranchID = s.BranchID
                                JOIN CFG.[User] u1 ON s.Creator = u1.UserID
                                JOIN CFG.[User] u2 ON s.LastEditor = u2.UserID
								join 
								(
								select 
									AdjustmentID,
									sum(Amount) Amount
								 from ast.Adjustmentitem
								 group by AdjustmentID
								)item on item.AdjustmentID = s.AdjustmentID
                                LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = s.PreVoucherID
                                LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = s.Creator
                                JOIN #vwBranchAccess AS vba ON vba.BranchID = s.BranchID                                                              
                        WHERE   ( s.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND s.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and s.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;


			IF OBJECT_ID('CNT.ConfirmStatement') IS NOT NULL
            AND EXISTS ( SELECT value
                         FROM   #DocumentNumType
                         WHERE  value = 'ConfirmStatement' )
            BEGIN


				SELECT @LocalizeEnumValue = LV.Value
			FROM   CFG.LocalizeEnum L
				   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
			WHERE  L.Enum = 'BaseDocuments'
				   AND L.Item = 'FinancialConfirm'
				   AND LV.Culture = @Culture;

				set @ViewRelatedToUser = null
				set @ViewRelatedToOthers = null				
				
                SELECT @ViewRelatedToUser = UserID
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ConfirmStatement'
		              AND AccessKey = 'ViewRelatedToUser'
		              AND UserID = @CurrentUser;

	            SELECT @ViewRelatedToOthers = UserID,
                       @UnauthorizedUsers = Users
	            FROM CFG.vwOperationLevelAccess
	            WHERE EntityName = 'ConfirmStatement'
		              AND AccessKey = 'ViewRelatedToOthers'
		              AND UserID = @CurrentUser;

				TRUNCATE TABLE #OperationLevelAccessUser
                
				INSERT  INTO #OperationLevelAccessUser   
				SELECT rfcst.value
                FROM
                (
                    SELECT  olau.Users
                    FROM CFG.vwOperationLevelAccess AS olau
                    WHERE olau.EntityName = 'ConfirmStatement' and olau.AccessKey = 'ViewRelatedToOthers' AND olau.UserID = @CurrentUser
                ) a
                CROSS APPLY CFG.R_FnCommaStr2Table(a.Users) AS rfcst;

                INSERT  INTO #MonitoringActivityVoucher
                        SELECT  'ConfirmStatement' ,
                                @LocalizeEnumValue ,
                                c.ConfirmStatementID,
                                c.Number,
                                CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType),
                                b.Code ,
                                case @CultureNo
										when 2 then b.Title2
										else b.Title
								end,
                                u1.Name ,
                                u2.Name ,
                                CASE WHEN c.PreVoucherID IS NULL THEN @Submit
                                     ELSE @PreVoucher
                                END ,
                                c.PreVoucherID ,
                                'ConfirmStatement' ,
                                @Contract,
                                item.Amount,
                                null ,
                                null,Null
                        FROM    CNT.ConfirmStatement c
						join CNT.[Contract] cn on c.ContractID = cn.ContractID
                        JOIN CFG.Branch b ON b.BranchID = cn.BranchID
                        JOIN CFG.[User] u1 ON c.Creator = u1.UserID
                        JOIN CFG.[User] u2 ON c.LastEditor = u2.UserID
						LEFT JOIN #VoucherPrevoucher v ON v.PrevoucherID = c.PreVoucherID
						LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = c.Creator
                        JOIN #vwBranchAccess AS vba ON vba.BranchID = cn.BranchID 
						join 
						(
						select 
							i.ConfirmStatementID,
							sum(i.Addition + i.Deduction) Amount
							from CNT.ConfirmStatementItem i
							group by i.ConfirmStatementID
						)item on item.ConfirmStatementID = c.ConfirmStatementID                                                                                         
                        WHERE initial = 0 and  ( c.PreVoucherID IS NULL
                                  OR v.PrevoucherID IS NULL
                                )
                                AND FinancialPeriodID = @FinancialPeriod
                                AND ( @CurrentUser = -1
                                    OR ( @ViewRelatedToUser IS NOT NULL AND c.Creator = @CurrentUser  )
                                    OR ( @ViewRelatedToOthers IS not NULL
                                        and c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                                    )
                                )
            END;
			

        SELECT ROW_NUMBER() OVER ( ORDER BY FormEngName ) AS RowID,*
        FROM #MonitoringActivityVoucher;

    END;

