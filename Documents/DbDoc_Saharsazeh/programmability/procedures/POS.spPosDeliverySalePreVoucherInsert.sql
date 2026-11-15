		
-------------------------------------------------------------------------------------------------------------------------
CREATE    PROCEDURE [POS].spPosDeliverySalePreVoucherInsert
	@DeliveryID NVARCHAR(MAX)
	 --WITH ENCRYPTION
AS

	    DECLARE @DocumentNumTypeId          INT = (
	                SELECT DocumentNumTypeID
	                FROM   CFG.DocumentNumType
	                WHERE  EngName = 'Delivery'
	            ),
	            @InstallmentsReceivableSl INT,
	            @AddedAndDeductedCashSl     INT,
	            @maxPVItemId                INT,
	            @PayableTaxSL               INT,
	            @PayableDutySL              INT,
	            @ReceivableAccounts         INT,
	            @SaleDiscountSlID           INT,
	            @IfDiscountVoucherable      VARCHAR(10),
	            @DateType                   VARCHAR(10),
	            @DateFormat                 VARCHAR(10),
	            @Culture                    VARCHAR(10),
	            @BaseCurrencyPrecision      TINYINT,
				@CreatorId INT,
				@ReceivableChequesSlID INT
				
				
		
		set @CreatorId = cfg.GetuserID();
	    
		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@DeliveryID) 	

	    SET @Culture = CFG.GetuserCulture()
	    SET @BaseCurrencyPrecision = [CFG].[GetBaseCurrencyPrecision]()
	    
	    SELECT @DateType = us.SettingValue
	    FROM   cfg.UserSetting us
	    WHERE  us.SettingKey = 'Date_Type'
	           AND us.UserID = @CreatorId
	    
	    IF @DateType IS NULL
	        SET @DateType = CASE @Culture
	                             WHEN 'fa' THEN 0
	                             WHEN 'en' THEN 1
	                             WHEN 'ar' THEN 2
	                        END
	    
	    SELECT @DateFormat = us.SettingValue
	    FROM   cfg.UserSetting us
	    WHERE  us.SettingKey = 'Date_Format'
	           AND us.UserID = @CreatorId
	    
	    IF @DateFormat IS NULL
	        SET @DATEFORMAT = 'YY/MM/DD'
	    
	    SELECT TOP 1 @IfDiscountVoucherable = LOWER(configvalue)
	    FROM   CFG.Configuration
	    WHERE  ConfigKey = 'SaleVoucherWithDiscount'
	    
	    SELECT @InstallmentsReceivableSl = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'InstallmentsReceivableSl'
	    
	    SELECT @AddedAndDeductedCashSl = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'AddedAndDeductedCashSl'
	    
	    SELECT @ReceivableAccounts = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'ReceivableAccounts'
	    
	    SELECT @SaleDiscountSlID = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'SaleDiscountSlID'
	    
	    SELECT @PayableDutySL = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'PayableDutySL'
	    
	    SELECT @PayableTaxSL = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'PayableTaxSL'
	    
	    SELECT @ReceivableChequesSlID = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'ReceivedDocumentSl'
	    
	    DECLARE @MaxPrevoucherID INT
	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by DeliveryID) PrevoucherID,	
				DeliveryID,
				s.branchid,
	            FinancialPeriodID,
	            DATE,
	            N'تحویل فروش ' + s.Title + N' در تاریخ ' + cfg.GetCLRSaturnDate(d.date, @DateFormat, 0, @DateType)+' به شماره '+cast(d.Number as varchar(50)) Description,
	            s.DlID StationDlID,
	            s.CostCenterDlID,
	            s.Title Station,
				cast(null as varchar(max)) ErrorMessage,
				OutgoingID,
				ReturnedOutgoingID
			into #Delivery
	    FROM   pos.Delivery d
		JOIN #DocumentIds DI ON DI.ID = D.DeliveryID
		JOIN pos.StationShift ss
			ON  ss.StationShiftID = d.StationShiftID
		JOIN pos.Station s
			ON  s.StationID = ss.StationID
		where PreVoucherID is null
	    
	    SELECT a.PosInvoiceID,
	           a.SaleModelID,
	           d.SaleSlID,
	           d.DiscountSlID,
	           d.ReturnedSaleSlID,
	           a.Price,
	           a.Discount,
	           StuffAccountGroupTitle,
	           s.Title     SaleModel,
	           a.StuffID,
			   h.DeliveryID,
			   b.Type,
			   b.code StuffCode
	    INTO   #SaleSl
	    FROM   pos.PosInvoiceItem a
	    JOIN pos.DeliveryPosInvoice dpi
	        ON  dpi.PosInvoiceID = a.PosInvoiceID
		join #Delivery h on h.DeliveryID = dpi.DeliveryID
	    JOIN sle.SaleModel s
	        ON  s.SaleModelID = a.SaleModelID
	    JOIN stf.VWStuff b
	        ON  a.StuffID = b.StuffID
	    LEFT JOIN stf.StuffSaleSl d
	        ON  d.StuffAccountGroupID = b.StuffAccountGroupID
	        AND d.SaleModelID = a.SaleModelID
	    
		update a
		 SET ErrorMessage = 'در کد کالای '+StuffCode+' مقدار گروه حساب مشخص نشده است:'
		 from #Delivery a
		 join #SaleSl b on a.DeliveryID = b.DeliveryID
		 WHERE  StuffAccountGroupTitle IS NULL


		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') + 'برای این تحویل فروش اسناد انبار صادر نشده است'
		 from #Delivery a
		 join #SaleSl b on a.DeliveryID = b.DeliveryID
	    WHERE  b.Type = 0 and OutgoingID is null and ReturnedOutgoingID is null  
				
		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') + 'معینهای فروش، برگشت فروش و تخفیف را کنترل نمایید'
		 from #Delivery a
		 join #SaleSl b on a.DeliveryID = b.DeliveryID
	    WHERE  (
	                ReturnedSaleSlID IS NULL
	                OR SaleSlID IS NULL
	                OR DiscountSlID IS NULL
	            )   

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END



	    
	    IF OBJECT_ID('tempdb..#Debits') IS NOT NULL
	        DROP TABLE #Debits
	    
	    CREATE TABLE #Debits
	    (
	    	ID                   INT,
	    	Amount               DECIMAL(30, 4),
	    	SlID                 INT,
	    	DlID                 INT,
	    	[Description]        NVARCHAR(MAX),
	    	PreVoucherItemID     INT,
	    	STATE                TINYINT,
	    	CurrencyID           INT,
	    	CurrencyRate         DECIMAL(36, 10),
	    	CurrencyAmount       DECIMAL(36, 10),
			PrevoucherID int
	    )
	    
	    DECLARE @MaxDebitId     INT,
	            @RoundSL        INT
	    
	    SELECT @RoundSL = ConfigValue
	    FROM   cfg.Configuration
	    WHERE  ConfigKey = 'RoundSL'
	    
	    -- روند بدهکار
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT ROW_NUMBER() OVER(ORDER BY DeliveryPosInvoiceid),
	           ABS(pri.RoundPrice),
	           @RoundSL,
	           NULL,
	           N'بابت روند فاکتور',
			   d.PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice pri
	                ON  pri.PosInvoiceID = dp.PosInvoiceID
	    WHERE  pri.RoundPrice < 0
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- کارتخوان
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        STATE,
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY DeliveryPosReceiptItemid),
	           pri.Amount,
	           CASE 
	                WHEN dp.State = 1 THEN cr.SlID
	                WHEN dp.State = 3 THEN @AddedAndDeductedCashSl
	                WHEN dp.State = 4 THEN @ReceivableAccounts
	                WHEN dp.State = 5 THEN @SaleDiscountSlID
	           END,
	           CASE 
	                WHEN dp.State = 1 THEN cr.DlID
	                WHEN dp.State = 3 THEN p.dlid
	                WHEN dp.State = 4 THEN p2.dlid
	           END,
	           N'دریافت وجه از کارتخوان' + '-' + d.Station,
	           dp.State,
			   d.PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN pos.PosReceipt pr
	                ON  pri.PosReceiptid = pr.PosReceiptid
	           JOIN cfg.party p2
	                ON  p2.PartyID = pr.CustomerID
	           JOIN cfg.[user] u
	                ON  u.UserID = pri.Creator
	           JOIN pos.CardReader cr
	                ON  cr.CardReaderID = pri.CardReaderID
	           LEFT JOIN cfg.party p
	                ON  p.PartyID = u.PartyId
	    WHERE  dp.State = 1 and pri.ItemType = 1
	    
		update a
		 SET ErrorMessage = 'در برخی از دستگاههای کارتخوان حساب معین تعریف نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  STATE = 1
	     AND SlID IS NULL 

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +  'در تنظیمات عمومی، معین کسر و اضافه صندوق مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  STATE = 3
	     AND SlID IS NULL 

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +   'در تنظیمات عمومی، معین حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  STATE = 4
	     AND SlID IS NULL 

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +   'در تنظیمات عمومی، معین تخفیفات نقدی فروش مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  STATE = 5
	     AND SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    
   
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- دریافت نقد
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        CurrencyID,
	        CurrencyRate,
	        CurrencyAmount,
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY c.dlid),
	           --SUM(
	               CASE 
	                    WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
	                             pri.Amount * pri.CurrencyRate / Currency.ExchangeUnit,
	                             @BaseCurrencyPrecision
	                         )
	                    WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
	                             pri.Amount * Currency.ExchangeUnit / pri.CurrencyRate,
	                             @BaseCurrencyPrecision
	                         )
	               END
	           --)
			   ,
	           CB.SLID,
	           c.dlid,
	           N'دریافت نقدی وجه فاکتور' + '-' + d.Station,
	           pri.CurrencyID,
	           pri.CurrencyRate,
	           pri.Amount, --SUM(pri.Amount),
			   d.PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	                AND pri.IsPayed = 0
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptID = pri.PosReceiptID
	           JOIN CFG.CASH C
	                ON  c.cashid = pri.CashID
	           LEFT JOIN cfg.CashBalance cb
	                ON  cb.currencyid = pri.CurrencyID
	                AND cb.cashid = c.cashid
	           LEFT JOIN cfg.Currency Currency
	                ON  Currency.CurrencyID = pri.CurrencyID
		where pri.ItemType = 2
	    --GROUP BY
	    --       c.dlid,
	    --       CB.SLID,
	    --       pri.CurrencyID,
	    --       pri.CurrencyRate,
			  -- d.PrevoucherID
    
	    
		update a
		 SET ErrorMessage = 'در ' + dl.Title + ' معین موجودی صندوق تعریف نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
		 JOIN acc.dl ON  dl.DLID = b.DlID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    

	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- بن کارت
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY sc.ShoppingCartID),
	           pri.Amount,
	           sc.SLID,
	           NULL,
	           N'دریافت بن کارت' + '-' + d.Station,
			   d.PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN ctm.ShoppingCart sc
	                ON  sc.ShoppingCartID = pri.ShoppingCartID
	    where pri.ItemType = 3
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- دریافت کارت وفاداری
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY pri.PosReceiptItemid),
	           pri.Amount,
	           CASE 
	                WHEN p.date IS NULL OR p.date BETWEEN scc.ChargeDate AND f.EndDate THEN scct.CurrentSlID
	                ELSE scct.YearsSlID
	           END,
	           p1.DlID,
	           N'تسویه از طریق کارت وفاداری' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN ctm.SubscribeCardCharge scc
	                ON  scc.SubscribeCardChargeID = pri.SubscribeCardChargeID
	           JOIN ctm.SubscribeCard sc
	                ON  sc.SubscribeCardID = scc.SubscribeCardID
	           JOIN cfg.Party p1
	                ON  p1.PartyID = sc.PartyID
	           JOIN ctm.SubscribeCardChargeType scct
	                ON  scct.SubscribeCardChargeTypeID = scc.SubscribeCardChargeTypeID
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptid = pri.PosReceiptid
	           LEFT JOIN pos.PosInvoice p
	                ON  p.PosInvoiceID = pr.PosInvoiceID
	           LEFT JOIN cfg.FinancialPeriod f
	                ON  f.FinancialPeriodID = p.FinancialPeriodID
	    WHERE  pr.IsPayed = 0 and pri.ItemType = 4
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
			
	    -- دریافت چک
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY pri.PosReceiptItemid),
	           pri.Amount,
	           @ReceivableChequesSlID,
	           Party.DlID,
	           N'دریافت چک' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptid = pri.PosReceiptid 
			   join cfg.Party on party.PartyID = pr.CustomerID
	    WHERE  pr.IsPayed = 0 and pri.ItemType = 5
	    
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )

	    -- دریافت حواله
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY pri.PosReceiptItemid),
	           pri.Amount,
	           ba.SLID,
	           ba.DlID,
	           N'دریافت حواله' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptid = pri.PosReceiptid 
			   join cfg.BankAccount ba on ba.BankAccountID = pri.BankAccountID
	    WHERE  pr.IsPayed = 0 and pri.ItemType = 6
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    -- برگشت فروش
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY ReturnedSaleSlID),
	           --SUM(
	               CASE 
	                    WHEN @ifdiscountvoucherable = 'true' THEN a.Price
	                    ELSE a.Price - a.Discount
	               END
	           --)
			   ,
	           ReturnedSaleSlID,
	           p.DlID,
	           N'برگشت فروش' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 1
	           JOIN (
	                    SELECT a.PosInvoiceID,
	                           a.SaleModelID,
	                           a.ReturnedSaleSlID,
	                           SUM(a.Price) Price,
	                           SUM(Discount) Discount
	                    FROM   #SaleSl a
	                    GROUP BY
	                           a.PosInvoiceID,
	                           a.SaleModelID,
	                           a.ReturnedSaleSlID
	                )A
	                ON  A.PosInvoiceID = [pi].PosInvoiceID
	           JOIN cfg.Party p
	                ON  p.PartyID = PI.CustomerID
		where
	               CASE 
	                    WHEN @ifdiscountvoucherable = 'true' THEN a.Price
	                    ELSE a.Price - a.Discount
	               END > 0
	    --GROUP BY
	    --       ReturnedSaleSlID,
	    --       p.DlID,
			  -- PrevoucherID
	    
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- فروشهای نسیه
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0),
	           @ReceivableAccounts,
	           p.dlid,
	           N'فروش نسیه' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	                AND [pi].HasCredit = 1
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID

		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، معین حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- فروشهای اقساطی
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0),
	           @InstallmentsReceivableSl,
	           p.dlid,
	           N'فروش اقساطی' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	                AND [pi].HasInstallment = 1
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID
	    
		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، معین اقساط دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- فروشهای تسویه نشده
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        STATE,
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           abs([pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0)-ISNULL(pr.discount, 0)),
	           CASE 
	                WHEN dp.Status = 3 THEN @AddedAndDeductedCashSl
	                WHEN dp.Status = 4 THEN @ReceivableAccounts
	                WHEN dp.Status = 5 THEN @SaleDiscountSlID
	           END,
	           CASE 
	                WHEN dp.Status = 3 THEN p2.DlID
	                WHEN dp.Status = 4 THEN p.DlID
	           END,
	           N'فروشهای تسویه نشده' + '-' + d.Station,
	           dp.Status,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	           JOIN cfg.[user] u
	                ON  u.userid = [pi].Creator
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID
	           LEFT JOIN cfg.Party p2
	                ON  p2.PartyID = u.PartyId
	    WHERE  [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) -ISNULL(pr.discount, 0) > 0
	           AND PI.HasCredit = 0
	           AND PI.HasInstallment = 0
	    
	    
		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، معین کسر و اضافه صندوق مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 3

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +  'در تنظیمات عمومی، معین حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 4

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +  'در تنظیمات عمومی، معین تخفیفات نقدی فروش مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 5

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END



	    --select * from #Debits where  SlID is null
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- مالیات برگشت فروش
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalTax,
	           @PayableTaxSL,
	           p.DlID,
	           N'مالیات' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 1
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	    WHERE  PI.TotalTax > 0
	    
		update a
		 SET ErrorMessage =  'در تنظیمات عمومی، معین مالیات پرداختنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END

	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- عوارض برگشت فروش
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalDuty,
	           @PayableDutySl,
	           p.DlID,
	           N'عوارض' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 1
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	    WHERE  PI.TotalDuty > 0
	    
		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، معین عوارض پرداختنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END


	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    -- پرداختهای نامشخص
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        CurrencyID,
	        CurrencyRate,
	        CurrencyAmount,
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY DeliveryPosReceiptItemid),
	           CASE 
	                WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
	                         pri.Amount * pri.CurrencyRate / Currency.ExchangeUnit,
	                         @BaseCurrencyPrecision
	                     )
	                WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
	                         pri.Amount * Currency.ExchangeUnit / pri.CurrencyRate,
	                         @BaseCurrencyPrecision
	                     )
	           END                          Amount,
	           @ReceivableAccounts,
	           p2.dlid,
	           N'پرداختهای نامشخص' + '-' + d.Station,
	           pri.CurrencyID,
	           pri.CurrencyRate,
	           pri.Amount,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	                AND pri.IsPayed = 1
	           JOIN pos.PosReceipt pr
	                ON  pri.PosReceiptid = pr.PosReceiptid
	           JOIN cfg.party p2
	                ON  p2.PartyID = pr.CustomerID
	           LEFT JOIN pos.DeliveryPosInvoice [pi]
	                ON  [pi].PosInvoiceID = pr.PosInvoiceID
	           LEFT JOIN cfg.Currency Currency
	                ON  Currency.CurrencyID = pri.CurrencyID
	    WHERE  [pi].PosInvoiceID IS     NULL
	    

	    --برگشت  فروشهایی که بیشتر از مبلغ برگشت پرداخت شده اند
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           ABS(
	               [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) -ISNULL(pr.discount, 0)
	           ),
	           CASE 
	                WHEN dp.Status = 3 THEN @AddedAndDeductedCashSl
	                WHEN dp.Status = 4 THEN @ReceivableAccounts
	                WHEN dp.Status = 5 THEN @SaleDiscountSlID
	           END,
	           CASE 
	                WHEN dp.Status = 3 THEN p2.DlID
	                WHEN dp.Status = 4 THEN p.DlID
	           END,
	           N'پرداختهای مازاد بر مبلغ برگشت' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 1
	           JOIN cfg.[user] u
	                ON  u.userid = [pi].Creator
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID
					and pr.IsPayed = 1
	           LEFT JOIN cfg.Party p2
	                ON  p2.PartyID = u.PartyId
	    WHERE  [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) -ISNULL(pr.discount, 0) < 0
	           AND PI.HasCredit = 0
	           AND PI.HasInstallment = 0	    
	    
		update a
		 SET ErrorMessage =  'در تنظیمات عمومی، حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END

	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    -- تخفیف
	    IF @ifdiscountvoucherable = 'true'
	    BEGIN
	        INSERT INTO #Debits
	          (
	            ID,
	            Amount,
	            SlID,
	            DlID,
	            [Description],
				PrevoucherID
	          )
	        SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY a.DiscountSlID),
	               a.Discount,--SUM(a.Discount),
	               a.DiscountSlID,
	               p.DlID,
	               N'تخفیف' + '-' + d.Station,
				   PrevoucherID
	        FROM   #delivery d
	               JOIN pos.DeliveryPosInvoice dp
	                    ON  d.DeliveryID = dp.DeliveryID
	               JOIN pos.PosInvoice [pi]
	                    ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                    AND [pi].IsReturnInvoice = 0
	               JOIN (
	                        SELECT a.PosInvoiceID,
	                               a.SaleModelID,
	                               a.SaleSlID,
	                               a.DiscountSlID,
	                               SUM(a.Discount) Discount
	                        FROM   #SaleSl a
	                        GROUP BY
	                               a.PosInvoiceID,
	                               a.SaleModelID,
	                               a.SaleSlID,
	                               a.DiscountSlID
	                    )A
	                    ON  A.PosInvoiceID = [pi].PosInvoiceID
	               JOIN cfg.Party p
	                    ON  p.PartyID = PI.CustomerID
	        WHERE  a.Discount > 0
	      --  GROUP BY
	      --         DiscountSlID,
	      --         p.DlID,
				   --PrevoucherID
	        
	        
	        SET @MaxDebitId = ISNULL(
	                (
	                    SELECT MAX(id)
	                    FROM   #Debits
	                ),
	                0
	            )
	    END
	    --بدهکار تخفیف نقدی فروش
	    
	    SELECT h.PosReceiptID
	    INTO   #Used_Discount
	    FROM   pos.PosReceipt H
	    JOIN pos.PosReceiptItem I
	        ON  H.PosReceiptID = I.PosReceiptID
	    JOIN pos.DeliveryPosReceiptItem dp
	        ON  I.PosReceiptItemID = dp.PosReceiptItemID
	    WHERE  H.Discount > 0
		and dp.DeliveryID not in (select DeliveryID from #Delivery)
	    GROUP BY
	           h.PosReceiptID
	    
	    SELECT h.PosReceiptID,d.PrevoucherID
	    INTO   #UnUsed_Discount
	    FROM   #delivery d
	    JOIN pos.DeliveryPosReceiptItem dp
	        ON  d.DeliveryID = dp.DeliveryID
	    JOIN pos.PosReceiptItem I
	        ON  I.PosReceiptItemID = dp.PosReceiptItemID
	    JOIN pos.PosReceipt H
	        ON  H.PosReceiptID = I.PosReceiptID
	    WHERE  H.Discount > 0
	    AND h.PosReceiptID NOT IN (SELECT PosReceiptID FROM   #Used_Discount)
	    GROUP BY
	           h.PosReceiptID,d.PrevoucherID
	    
	    INSERT INTO #Debits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY a.PosReceiptID),
	           H.Discount,
	           @SaleDiscountSlID,
	           NULL,
	           N'تخفیف نقدی فروش فروشگاهی' ,
			   PrevoucherID
	    FROM   pos.PosReceipt H
	    JOIN #UnUsed_Discount A
	        ON  H.PosReceiptID = A.PosReceiptID
	    JOIN cfg.party P
	        ON  P.PartyID = H.CustomerID

	    
		update a
		 SET ErrorMessage = 'در تنظیمات عمومی معین تخفیف نقدی فروش مشخص نشده است.'
		 from #Delivery a
		 join #Debits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
		

	    
	    
	    SET @MaxDebitId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Debits
	            ),
	            0
	        )
	    
	    IF OBJECT_ID('tempdb..#Credits') IS NOT NULL
	        DROP TABLE #Credits
	    
	    CREATE TABLE #Credits
	    (
	    	ID                   INT,
	    	Amount               DECIMAL(30, 4),
	    	SlID                 INT,
	    	DlID                 INT,
	    	[Description]        NVARCHAR(MAX),
	    	PreVoucherItemID     INT,
	    	STATE                TINYINT,
	    	CurrencyID           INT,
	    	CurrencyRate         DECIMAL(36, 10),
	    	CurrencyAmount       DECIMAL(36, 10),
			PrevoucherID int
	    )
	    
	    DECLARE @MaxCreditId INT
	    
	    -- روند بستانکار
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT ROW_NUMBER() OVER(ORDER BY DeliveryPosInvoiceid),
	           ABS(pri.RoundPrice),
	           @RoundSL,
	           NULL,
	           N'بابت روند فاکتور',
			   PrevoucherID
	    FROM  #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice pri
	                ON  pri.PosInvoiceID = dp.PosInvoiceID
	    WHERE  pri.RoundPrice > 0
	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            0
	        )
	    -- دریافتهای نامشخص
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        CurrencyID,
	        CurrencyRate,
	        CurrencyAmount,
			PrevoucherID
	      )
	    SELECT @MaxDebitId + ROW_NUMBER() OVER(ORDER BY DeliveryPosReceiptItemid),
	           CASE 
	                WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
	                         pri.Amount * pri.CurrencyRate / Currency.ExchangeUnit,
	                         @BaseCurrencyPrecision
	                     )
	                WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
	                         pri.Amount * Currency.ExchangeUnit / pri.CurrencyRate,
	                         @BaseCurrencyPrecision
	                     )
	           END                          Amount,
	           @ReceivableAccounts,
	           p2.dlid,
	           N'دریافتهای نامشخص' + '-' + d.Station,
	           pri.CurrencyID,
	           pri.CurrencyRate,
	           pri.Amount,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	                AND pri.IsPayed = 0
	           JOIN pos.PosReceipt pr
	                ON  pri.PosReceiptid = pr.PosReceiptid
	           JOIN cfg.party p2
	                ON  p2.PartyID = pr.CustomerID
	           LEFT JOIN pos.DeliveryPosInvoice [pi]
	                ON  [pi].PosInvoiceID = pr.PosInvoiceID
	           LEFT JOIN cfg.Currency Currency
	                ON  Currency.CurrencyID = pri.CurrencyID
	    WHERE  [pi].PosInvoiceID IS     NULL
	    
	    
		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL 

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
		
	    

	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    --  فروش
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY SaleSlID),
	           --SUM(
	               CASE 
	                    WHEN @ifdiscountvoucherable = 'true' THEN a.Price
	                    ELSE a.Price - a.Discount
	               END
	           --)
			   ,
	           SaleSlID,
	           p.DlID,
	           N'صورت حسابهای صندوق فروش' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	           JOIN (
	                    SELECT a.PosInvoiceID,
	                           a.SaleModelID,
	                           a.SaleSlID,
	                           SUM(a.Price) Price,
	                           SUM(a.Discount) Discount
	                    FROM   #SaleSl a
	                    GROUP BY
	                           a.PosInvoiceID,
	                           a.SaleModelID,
	                           a.SaleSlID
	                )A
	                ON  A.PosInvoiceID = [pi].PosInvoiceID
	           JOIN cfg.Party p
	                ON  p.PartyID = PI.CustomerID
	    WHERE		(CASE 
	                    WHEN @ifdiscountvoucherable = 'true' THEN a.Price
	                    ELSE a.Price - a.Discount
	               END ) > 0
	    --GROUP BY
	    --       SaleSlID,
	    --       p.DlID,
			  -- PrevoucherID
	    
	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    --برگشت فروشهای تسویه نشده
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        STATE,
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0),
	           CASE 
	                WHEN dp.Status = 3 THEN @AddedAndDeductedCashSl
	                WHEN dp.Status = 4 THEN @ReceivableAccounts
	                WHEN dp.Status = 5 THEN @SaleDiscountSlID
	           END,
	           CASE 
	                WHEN dp.Status = 3 THEN p2.DlID
	                WHEN dp.Status = 4 THEN p.DlID
	           END,
	           N'برگشت فروشهای تسویه نشده' + '-' + d.Station,
	           dp.Status,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 1
	           JOIN cfg.[user] u
	                ON  u.userid = [pi].Creator
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID
	           LEFT JOIN cfg.Party p2
	                ON  p2.PartyID = u.PartyId
	    WHERE  [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) - ISNULL(pr.Discount, 0) > 0
	    
	    

		update a
		 SET ErrorMessage = 'در تنظیمات عمومی، معین کسر و اضافه صندوق  مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 3

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') +'در تنظیمات عمومی، معین حسابهای دریافتنی مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 4

		update a
		 SET ErrorMessage = isnull(ErrorMessage,'') + 'در تنظیمات عمومی، معین تخفیفات نقدی فروش  مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL AND STATE = 5

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
		
	    
    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    -- مالیات فروش
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalTax,
	           @PayableTaxSL,
	           p.DlID,
	           N'مالیات فروش' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	    WHERE  PI.TotalTax > 0
	    
		update a
		 SET ErrorMessage =  'در تنظیمات عمومی، معین مالیات پرداختنی  مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    

	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    -- عوارض فروش
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           [pi].TotalDuty,
	           @PayableDutySl,
	           p.DlID,
	           N'عوارض فروش' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	    WHERE  PI.TotalDuty > 0
	    
	    
	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
		update a
		 SET ErrorMessage =  'در تنظیمات عمومی، معین عوارض پرداختنی  مشخص نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
	    WHERE  SlID IS NULL

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    

	    
	    -- پرداخت نقد
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        CurrencyID,
	        CurrencyRate,
	        CurrencyAmount,
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY c.dlid),
	           --SUM(
	               CASE 
	                    WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
	                             pri.Amount * pri.CurrencyRate / Currency.ExchangeUnit,
	                             @BaseCurrencyPrecision
	                         )
	                    WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
	                             pri.Amount * Currency.ExchangeUnit / pri.CurrencyRate,
	                             @BaseCurrencyPrecision
	                         )
	               END
	           --)
			   ,
	           CB.SLID,
	           c.dlid,
	           N'پرداخت نقدی' + '-' + d.Station,
	           pri.CurrencyID,
	           pri.CurrencyRate,
	           pri.Amount,--SUM(pri.Amount),
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	                AND pri.IsPayed = 1
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptID = pri.PosReceiptID
	           JOIN CFG.CASH C
	                ON  c.cashid = pri.CashID
	           LEFT JOIN cfg.CashBalance cb
	                ON  cb.currencyid = pri.CurrencyID
	                AND cb.cashid = c.cashid
	           LEFT JOIN cfg.Currency Currency
	                ON  Currency.CurrencyID = pri.CurrencyID
	    --GROUP BY
	    --       c.dlid,
	    --       CB.SLID,
	    --       pri.CurrencyID,
	    --       pri.CurrencyRate,
			  -- PrevoucherID
	    
	    
		update a
		 SET ErrorMessage = 'در ' + dl.Title + ' معین موجودی صندوق تعریف نشده است.'
		 from #Delivery a
		 join #Credits b on a.PrevoucherID = b.PrevoucherID
		 JOIN acc.dl ON  dl.DLID = b.DlID
	    WHERE  SlID IS NULL

    
		if exists (select * from #Delivery where ErrorMessage is not null )
		BEGIN	
			select DeliveryID,ErrorMessage from #Delivery
			RETURN;
	    END
	    


	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    -- پرداخت از طریق شارژ کارت وفاداری
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY pri.PosReceiptItemid),
	           pri.Amount,
	           CASE 
	                WHEN p.date IS NULL OR p.date BETWEEN scc.ChargeDate AND f.EndDate THEN scct.CurrentSlID
	                ELSE scct.YearsSlID
	           END,
	           p1.DlID,
	           N'پرداخت از طریق شارژ کارت وفاداری' + '-' + d.Station,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosReceiptItem dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosReceiptItem pri
	                ON  pri.PosReceiptItemid = dp.PosReceiptItemid
	           JOIN ctm.SubscribeCardCharge scc
	                ON  scc.SubscribeCardChargeID = pri.SubscribeCardChargeID
	           JOIN ctm.SubscribeCard sc
	                ON  sc.SubscribeCardID = scc.SubscribeCardID
	           JOIN cfg.Party p1
	                ON  p1.PartyID = sc.PartyID
	           JOIN ctm.SubscribeCardChargeType scct
	                ON  scct.SubscribeCardChargeTypeID = scc.SubscribeCardChargeTypeID
	           JOIN pos.PosReceipt pr
	                ON  pr.PosReceiptid = pri.PosReceiptid
	           LEFT JOIN pos.PosInvoice p
	                ON  p.PosInvoiceID = pr.PosInvoiceID
	           LEFT JOIN cfg.FinancialPeriod f
	                ON  f.FinancialPeriodID = p.FinancialPeriodID
	    WHERE  pr.IsPayed = 1
	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    -- تخفیف برگشت فروش
	    IF @ifdiscountvoucherable = 'true'
	    BEGIN
	        INSERT INTO #Credits
	          (
	            ID,
	            Amount,
	            SlID,
	            DlID,
	            [Description],
				PrevoucherID
	          )
	        SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY a.DiscountSlID),
	               a.Discount,--SUM(a.Discount),
	               a.DiscountSlID,
	               p.DlID,
	               N'تخفیف برگشت فروش' + '-' + d.Station,
				   PrevoucherID
	        FROM   #delivery d
	               JOIN pos.DeliveryPosInvoice dp
	                    ON  d.DeliveryID = dp.DeliveryID
	               JOIN pos.PosInvoice [pi]
	                    ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                    AND [pi].IsReturnInvoice = 1
	               JOIN (
	                        SELECT a.PosInvoiceID,
	                               a.SaleModelID,
	                               a.SaleSlID,
	                               a.DiscountSlID,
	                               SUM(a.Discount) Discount
	                        FROM   #SaleSl a
	                        GROUP BY
	                               a.PosInvoiceID,
	                               a.SaleModelID,
	                               a.SaleSlID,
	                               a.DiscountSlID
	                    )A
	                    ON  A.PosInvoiceID = [pi].PosInvoiceID
	               JOIN cfg.Party p
	                    ON  p.PartyID = PI.CustomerID
	        WHERE a.Discount > 0
	      --  GROUP BY
	      --         DiscountSlID,
	      --         p.DlID,
				   --PrevoucherID
	        
	        
	        
	        SET @MaxCreditId = ISNULL(
	                (
	                    SELECT MAX(id)
	                    FROM   #Credits
	                ),
	                @MaxDebitId
	            )
	    END
	    -- بستانکار تخفیف نقدی فروش
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY a.PosReceiptID),
	           H.Discount,
	           @ReceivableAccounts,
	           p.DlID,
	           N'تخفیف نقدی فروش فروشگاهی',
			   PrevoucherID
	    FROM   pos.PosReceipt H
	           JOIN #UnUsed_Discount A
	                ON  H.PosReceiptID = A.PosReceiptID
	           JOIN cfg.party P
	                ON  P.PartyID = H.CustomerID
	           LEFT JOIN pos.DeliveryPosInvoice i
	                ON  i.PosInvoiceID = h.PosInvoiceID
	    WHERE  i.PosInvoiceID IS NULL
	    
	    SET @MaxCreditId = ISNULL(
	            (
	                SELECT MAX(id)
	                FROM   #Credits
	            ),
	            @MaxDebitId
	        )
	    
	    -- فروشهایی که بیشتر از مبلغ فاکتور دریافت شده اند
	    INSERT INTO #Credits
	      (
	        ID,
	        Amount,
	        SlID,
	        DlID,
	        [Description],
	        STATE,
			PrevoucherID
	      )
	    SELECT @MaxCreditId + ROW_NUMBER() OVER(ORDER BY dp.DeliveryPosInvoiceID),
	           ABS(
	               [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) -ISNULL(pr.discount, 0)
	           ),
	           CASE 
	                WHEN dp.Status = 3 THEN @AddedAndDeductedCashSl
	                WHEN dp.Status = 4 THEN @ReceivableAccounts
	                WHEN dp.Status = 5 THEN @SaleDiscountSlID
	           END,
	           CASE 
	                WHEN dp.Status = 3 THEN p2.DlID
	                WHEN dp.Status = 4 THEN p.DlID
	           END,
	           N'دریافتهای مازاد بر مبلغ فاکتور' + '-' + d.Station,
	           dp.Status,
			   PrevoucherID
	    FROM   #delivery d
	           JOIN pos.DeliveryPosInvoice dp
	                ON  d.DeliveryID = dp.DeliveryID
	           JOIN pos.PosInvoice [pi]
	                ON  [pi].PosInvoiceID = dp.PosInvoiceID
	                AND [pi].IsReturnInvoice = 0
	           JOIN cfg.[user] u
	                ON  u.userid = [pi].Creator
	           JOIN cfg.Party p
	                ON  p.partyid = [pi].CustomerID
	           LEFT JOIN pos.PosReceipt pr
	                ON  pr.PosInvoiceID = [pi].PosInvoiceID
	           LEFT JOIN cfg.Party p2
	                ON  p2.PartyID = u.PartyId
	    WHERE  [pi].TotalNetPrice - ISNULL(pr.TotalAmount, 0) -ISNULL(pr.discount, 0) < 0
	           AND PI.HasCredit = 0
	           AND PI.HasInstallment = 0
	    
	    
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on		    
	    INSERT INTO [ACC].[PreVoucher]
	      ([PreVoucherID],
	        [BranchID],
	        [DocumentNumtypeID],
	        [Date],
	        [FinancialPeriodID],
	        [Description],
	        [Description2],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT [PreVoucherID],
			   BranchId,
	           @DocumentNumTypeId,
	           date,
	           FinancialPeriodID,
	           Description,
	           Description,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
		from #Delivery
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from pos.Delivery a
		join #Delivery b on a.DeliveryID = b.DeliveryID
	    	    
    
	    SET @maxPVItemId = ISNULL(
	            (
	                SELECT MAX(PreVoucherItemID)
	                FROM   acc.PreVoucherItem pvi
	            ),
	            0
	        );	
	    
	    
	    
	    UPDATE #Debits
	    SET    PreVoucherItemID = @maxPVItemId + ID
	    
	    SET IDENTITY_INSERT ACC.PreVoucherItem ON
	    INSERT INTO ACC.PreVoucherItem
	      (
	        PreVoucherItemID,
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	      )
	    SELECT PreVoucherItemID,
	           PreVoucherId,
	           ID,
	           slid,
	           DESCRIPTION,
	           DESCRIPTION,
	           amount,
	           0,
	           CASE 
	                WHEN CurrencyID IS NULL THEN -1
	                ELSE CurrencyID
	           END,
	           CASE 
	                WHEN CurrencyID IS NULL THEN 1
	                ELSE CurrencyRate
	           END,
	           CASE 
	                WHEN CurrencyID IS NULL THEN amount
	                ELSE CurrencyAmount
	           END,
	           0,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Debits
	    
	    SET IDENTITY_INSERT ACC.PreVoucherItem OFF
	    
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           a.DLID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Debits a
	           JOIN acc.AccountLevelSL al
	                ON  al.SlID = a.SlID
	           JOIN acc.dl
	                ON  dl.dlid = a.dlid
	                AND al.dltypeid = dl.dltypeid
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           h.StationDlID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Debits a
		join #Delivery h on h.PrevoucherID = a.PrevoucherID
	    JOIN acc.AccountLevelSL al ON  al.SlID = a.SlID
		join acc.dl on dl.DLID = h.StationDlID and dl.DlTypeID = al.DlTypeID
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           dl.DLID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Debits a
		join #Delivery h on h.PrevoucherID = a.PrevoucherID
	    JOIN acc.AccountLevelSL al ON  al.SlID = a.SlID
		join acc.dl on dl.DLID = h.CostCenterDlID and dl.DlTypeID = al.DlTypeID


	    
	    
	    SET @maxPVItemId = ISNULL(
	            (
	                SELECT MAX(PreVoucherItemID)
	                FROM   acc.PreVoucherItem pvi
	            ),
	            0
	        );	
	    
	    
	    UPDATE #Credits
	    SET    PreVoucherItemID = @maxPVItemId + ID
	    
	    SET IDENTITY_INSERT ACC.PreVoucherItem ON
	    INSERT INTO ACC.PreVoucherItem
	      (
	        PreVoucherItemID,
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	      )
	    SELECT PreVoucherItemID,
	           PreVoucherId,
	           ID,
	           slid,
	           DESCRIPTION,
	           DESCRIPTION,
	           0,
	           amount,
	           CASE 
	                WHEN CurrencyID IS NULL THEN -1
	                ELSE CurrencyID
	           END,
	           CASE 
	                WHEN CurrencyID IS NULL THEN 1
	                ELSE CurrencyRate
	           END,
	           0,
	           CASE 
	                WHEN CurrencyID IS NULL THEN amount
	                ELSE CurrencyAmount
	           END,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Credits
	    
	    SET IDENTITY_INSERT ACC.PreVoucherItem OFF
	    
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           a.DLID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Credits a
	           JOIN acc.AccountLevelSL al
	                ON  al.SlID = a.SlID
	           JOIN acc.dl
	                ON  dl.dlid = a.dlid
	                AND al.dltypeid = dl.dltypeid		
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           StationDlID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Credits a
		join #Delivery h on h.PrevoucherID = a.PrevoucherID
	    JOIN acc.AccountLevelSL al ON  al.SlID = a.SlID
		join acc.dl on dl.DlTypeID = al.DlTypeID and dl.DLID = h.StationDlID
	    
	    
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	      (
	        [PreVoucherItemID],
	        [AccountLevelID],
	        [DlID],
	        [Value],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT PreVoucherItemId,
	           al.AccountLevelID,
	           dl.DLID,
	           NULL,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    FROM   #Credits a
		join #Delivery h on h.PrevoucherID = a.PrevoucherID
	    JOIN acc.AccountLevelSL al ON  al.SlID = a.SlID
		join acc.dl on dl.DLID = h.CostCenterDlID and dl.DlTypeID = al.DlTypeID
