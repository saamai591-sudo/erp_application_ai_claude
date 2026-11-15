
CREATE   PROC [CFG].SpSaleAndPurchaseDataSource
(
	@FromDate DATE = NULL,
	@ToDate DATE,
	@PartyID BIGINT = NULL,
	@CurrencyID INT = NULL,
	@TableName NVARCHAR(MAX),
	@Type VARCHAR(25)
)
--WITH ENCRYPTION 
AS
	SET NOCOUNT ON


	SELECT vpa.*
	INTO   #PartyAccess
	FROM   cfg.vwPartyAccess AS vpa
	join cfg.party p on p.PartyID = vpa.PartyID
	where
	(
	(@Type = 'Customer' and p.IsCustomer = 1)
	or
	(@Type = 'Vendor' and p.IsVendor = 1)
	or
	(@Type = 'Party' and (p.IsCustomer = 1 or p.IsVendor = 1) )
	)



	declare @Query nvarchar(max),
				@DateType tinyint,
				@DateFormat Nvarchar(10)
	  
	SELECT * INTO #Stuff
	FROM stf.VWStuff AS v


	SELECT * into #vwBranchAccess
	FROM cfg.vwBranchAccess AS vba

	set @Query = N'
	IF OBJECT_ID(''tempdb..'+@TableName+''') IS NOT NULL 
	drop table '+@TableName
	exec(@Query)

	set @Query = N'
	create table '+@TableName+'
	(
		DocumentID int,
		EngName varchar(1024),
		[Type] varchar(256),
		[Date] date,
		[Description] nvarchar(max),
		[HeaderDescription] nvarchar(max),
		[Number] nvarchar(256),
		[Debit] decimal(30,4),
		[Credit] decimal(30,4),
		CurrencyID int,
		PartyID bigint,
		StuffCode nvarchar(max),
		StuffTitle nvarchar(max),
		MainQuantity decimal(30,4),
		SubQuantity decimal(30,4),
		Fee decimal(30,4),
		Price decimal(30,4),
		Discount decimal(30,4),
		Vat  decimal(30,4),
		SalePurchase decimal(30,4),
		Returned decimal(30,4),
		Received decimal(30,4),
		Payed decimal(30,4),
		StuffID INT,
CreationDate DateTime
	)'
	exec(@Query)

		CREATE TABLE #OperationLevelAccessUser ( userid INT );

        DECLARE @Culture  VARCHAR(10),
				@ReceivedBankDraft NVARCHAR(MAX),
				@ReceivedCheqe NVARCHAR(MAX),
				@ReceivedCash NVARCHAR(MAX),
				@DiscountInReceiveReceipt NVARCHAR(MAX),
				@DrawBackReceivedCheqe NVARCHAR(MAX),
				@ReturnOfSpendedReceivedCheqe NVARCHAR(MAX),
				@ProtestCheqe NVARCHAR(MAX),
				@Payment NVARCHAR(MAX),
				@DiscountInPaymentReceipt NVARCHAR(MAX),
				@DrawBackPaymentCheqe NVARCHAR(MAX),
				@PaymentInPettyCash NVARCHAR(MAX),
				@CultureNo TINYINT,
				@user int,
				@invoice NVARCHAR(MAX),
				@PosInvoice NVARCHAR(MAX),
				@PosReceipt NVARCHAR(MAX)

		SET	 @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SET @user=cfg.GetuserID()
		
				SELECT @DateType = cfg.GetCurrentUserDateType()

	
			SELECT @DateFormat = cfg.GetCurrentUserDateFormat()
	--Get Translation
	BEGIN

	SELECT @invoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'invoice'
	       AND lev.Culture = @Culture
	       
	SELECT @PosInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'PosInvoice'
	       AND lev.Culture = @Culture     
	       
	       
	       
	       
	       SELECT *  into #vwEnums 
	       FROM cfg.VwEnums AS ve
	       WHERE ve.Enum = 'SystemEntities'
	   
	   	SELECT @PosReceipt = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'PosReceipt'
	       AND lev.Culture = @Culture    
   

	SELECT @ReceivedBankDraft = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'ReceivedBankDraft'
	       AND lev.Culture = @Culture

	SELECT @ReceivedCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'ReceivedCheqe'
	       AND lev.Culture = @Culture

	SELECT @ReceivedCash = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'ReceivedCash'
	       AND lev.Culture = @Culture

	SELECT @DiscountInReceiveReceipt = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'DiscountInReceiveReceipt'
	       AND lev.Culture = @Culture

	SELECT @DrawBackReceivedCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'DrawBackReceivedCheqe'
	       AND lev.Culture = @Culture

	SELECT @ReturnOfSpendedReceivedCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'ReturnOfSpendedReceivedCheqe'
	       AND lev.Culture = @Culture

	SELECT @ProtestCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'ProtestCheqe'
	       AND lev.Culture = @Culture

	SELECT @Payment = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'Payment'
	       AND lev.Culture = @Culture

	SELECT @DiscountInPaymentReceipt = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'DiscountInPaymentReceipt'
	       AND lev.Culture = @Culture

	SELECT @DrawBackPaymentCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'DrawBackPaymentCheqe'
	       AND lev.Culture = @Culture

	SELECT @PaymentInPettyCash = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'PaymentInPettyCash'
	       AND lev.Culture = @Culture
	END
		
	IF @Type<>'Vendor'
	BEGIN



		set @Query = N'
			insert into '+@TableName+'
			SELECT
					i.InvoiceID DocumentID,
					''SaleManager.Invoice'' EngName,
					''Customer'' [Type],
					i.Date,
					@invoice+'' ''+isnull(case when @CultureNo = 1 then vi.[Description] else vi.[Description2] end,'''') ,
					@invoice ,
					i.Number,
					vi.Price - vi.Discount+vi.Tax+vi.Duty [Debit] ,
					0 [Credit],
					i.CurrencyID,
					I.CustomerID PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
					vi.MainQuantity MainQuantity,
					vi.SubQuantity SubQuantity,
					vi.Fee Fee,
					vi.Price Price,
					-vi.Discount Discount,
					vi.tax + vi.Duty Vat,
					vi.Price SalePurchase,
					0 Returned,
					0 Received,
					0 Payed, 
					vi.StuffID,
i.CreationDate
			 FROM sle.Invoice i
			 JOIN sle.InvoiceItem Vi on Vi.InvoiceID = i.InvoiceID
			 JOIN #Stuff s on s.StuffID = vi.StuffID
			 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
			where  i.SaleInvoiceStatus <> 5
			and( (select lower(ConfigValue) from CFG.Configuration
			where ConfigKey = ''InvoiceNeedConfirm'') = ''false''
				or
				i.SaleInvoiceStatus=2)
			and (@CurrencyID is null or i.CurrencyID = @CurrencyID)
			and  (@PartyID is null or I.CustomerID = @PartyID)
			and
			((@FromDate is null and i.date < @ToDate)
			or
			(@FromDate is not null and i.date between @FromDate and @ToDate)
			)'

	
		EXECUTE sp_executeSQL     
					@Query,
					N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@invoice NVARCHAR(MAX)',
					@CurrencyID = @CurrencyID,
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
					@user=@user,
					@invoice = @invoice


		declare @ReturnedSaleInvoice nvarchar(256)
		SELECT @ReturnedSaleInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'SaleAndPurchaseBill'
			   AND le.Item = 'ReturnedSaleInvoice'
			   AND lev.Culture = @Culture

	
			set @Query = N'
			insert into '+@TableName+'
			SELECT 		i.ReturnedSaleInvoiceID DocumentID,
			   ''SaleManager.ReturnedSaleInvoice'' EngName,
				''Customer'' [Type],
					i.Date,
					@ReturnedSaleInvoice+'' ''+isnull(case when @CultureNo = 1 then vi.[Description] else vi.[Description2] end,'''') ,
					@ReturnedSaleInvoice,
					i.Number,
					0 [Debit],
					vi.Price - vi.Discount+vi.Tax+vi.Duty [Credit],
					i.CurrencyID,
					I.CustomerID PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end  StuffTitle,
					-vi.MainQuantity MainQuantity,
					-vi.SubQuantity SubQuantity,
					vi.Fee Fee,
					-vi.Price Price,
					vi.Discount Discount,
					-(vi.tax + vi.Duty) Vat,
					0 SalePurchase,
					-vi.Price Returned,
					0 Received,
					0 Payed,
					vi.StuffID,
i.CreationDate
			 FROM sle.ReturnedSaleInvoice i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
			 join sle.ReturnedSaleInvoiceItem Vi on vi.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
			 join #Stuff s on s.StuffID = vi.StuffID
			 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
			where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
			and  (@PartyID is null or I.CustomerID = @PartyID)
			and
			((@FromDate is null and i.date < @ToDate)
			or
			(@FromDate is not null and i.date between @FromDate and @ToDate)
			)		'
		EXECUTE sp_executeSQL     
					@Query,
					N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@ReturnedSaleInvoice nvarchar(256)',
					@CurrencyID = @CurrencyID,
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
					@user=@user,
					@ReturnedSaleInvoice = @ReturnedSaleInvoice

	END

	IF @Type<>'Customer'
	BEGIN
	
		declare @PurchaseInvoice nvarchar(256)
		SELECT @PurchaseInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'SaleAndPurchaseBill'
			   AND le.Item = 'PurchaseInvoice'
			   AND lev.Culture = @Culture

			set @Query = N'
			insert into '+@TableName+'
			SELECT 	i.PurchaseInvoiceID DocumentID,
					''VendorManager.PurchaseInvoice'' EngName,
					''Vendor'' [Type],
					i.Date,
					case when @CultureNo = 1 then isnull(ii.[Description],'''') else isnull(ii.[Description2],'''') end + @PurchaseInvoice + '' '' + isnull(i.InvoiceNumber,'''') ,
					@PurchaseInvoice,
					i.Number,
					0 [Debit],
					ii.Price - ii.Discount+ii.Tax+ii.Duty [Credit],
					i.CurrencyID,
					P.PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end  StuffTitle,
					ii.MainQuantity MainQuantity,
					ii.SubQuantity SubQuantity,
					ii.Fee Fee,
					-ii.Price Price,
					ii.Discount Discount,
					-(ii.tax + ii.Duty) Vat,
					-ii.Price SalePurchase,
					0 Returned,
					0 Received,
					0 Payed,
					ii.StuffID,
i.CreationDate
			 FROM vnd.PurchaseInvoice  i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
			 join vnd.PurchaseInvoiceItem ii on ii.PurchaseInvoiceID = i.PurchaseInvoiceID
		 			 join #Stuff s on s.StuffID = ii.StuffID
			join cfg.Party P on P.DlID = I.DlID
			 INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
			where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
			and  (@PartyID is null or P.PartyID = @PartyID)
			and
			((@FromDate is null and i.date < @ToDate)
			or
			(@FromDate is not null and i.date between @FromDate and @ToDate)
			)		'

		EXECUTE sp_executeSQL     
					@Query,
					N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@PurchaseInvoice nvarchar(256)',
					@CurrencyID = @CurrencyID,
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
					@user=@user,
					@PurchaseInvoice = @PurchaseInvoice 

		declare @ReturnedInvoice nvarchar(256)
		SELECT @ReturnedInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'SaleAndPurchaseBill'
			   AND le.Item = 'ReturnInvoice'
			   AND lev.Culture = @Culture

			set @Query = N'
			insert into '+@TableName+'
			SELECT	i.ReturnInvoiceID DocumentID,
			   ''VendorManager.ReturnInvoice'' EngName,
				''Vendor'' [Type],
					i.Date,
				@ReturnedInvoice + '' ''+	case when @CultureNo = 1 then ii.[Description] else ii.[Description2] end,
					@ReturnedInvoice,
					i.Number,
					ii.Price - ii.Discount+ii.Tax+ii.Duty [Debit],
					0 [Credit],
					i.CurrencyID,
					P.PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end  StuffTitle,
					ii.MainQuantity MainQuantity,
					ii.SubQuantity SubQuantity,
					ii.Fee Fee,
					ii.Price Price,
					-ii.Discount Discount,
					ii.tax + ii.Duty Vat,
					0 SalePurchase,
					ii.Price Returned,
					0 Received,
					0 Payed ,
					ii.StuffID,
i.CreationDate
			 FROM vnd.ReturnInvoice  i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
			 join vnd.ReturnInvoiceItem ii on i.ReturnInvoiceID = ii.ReturnInvoiceID
			 join #Stuff s on s.stuffid = ii.StuffID
			join cfg.Party P on P.DlID = I.DlID
			INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
			where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
			and  (@PartyID is null or P.PartyID = @PartyID)
			and
			((@FromDate is null and i.date < @ToDate)
			or
			(@FromDate is not null and i.date between @FromDate and @ToDate)
			)		'
		EXECUTE sp_executeSQL     
					@Query,
					N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@ReturnedInvoice nvarchar(256)',
					@CurrencyID = @CurrencyID,
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
						@user=@user,
						@ReturnedInvoice = @ReturnedInvoice 
	END

	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.ReceiveReceiptID DocumentID,
	       ''FinanceManager.ReceiveReceipt'' EngName,
		   case when RT.Type in (1,2,3) then ''Customer''
					else ''Vendor'' end [Type],
				rbd.Date,
				@ReceivedBankDraft + '' ''+ case when @CultureNo = 1 then d.Title else d.Title2 end+ '' '' +isnull(case when @CultureNo = 1 then  rbd.Description else rbd.Description2 end,'''') ,
				@ReceivedBankDraft+'' '' + case when @CultureNo = 1 then i.Description else i.Description2 end,
				rbd.Number,
				0 [Debit],
				rs.Amount  [Credit],
				rs.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				-rs.Amount Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				-rs.Amount Received,
				0 Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.ReceiveReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceivedBankDraft rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.BankAccount ba ON ba.BankAccountID = rbd.BankAccountID
		 JOIN acc.DL d ON d.DLID = ba.DlID
		 join fin.ReceiveSubject RS on RS.ReceivedBankDraftID = rbd.ReceivedBankDraftID
		 join cfg.party p on p.dlid = rs.dlid
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where RT.Type in (1,2,3,4)
		and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	
	EXECUTE sp_executeSQL
				@Query,
				N'@ReceivedBankDraft nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int',
				@ReceivedBankDraft = @ReceivedBankDraft,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@CultureNo = @CultureNo,
				@user=@user
		
	set @Query = N'
		insert into '+@TableName+'	
		SELECT	i.ReceiveReceiptID DocumentID,
	       ''FinanceManager.ReceiveReceipt'' EngName,
		   case when RT.Type in (1,2,3) then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@ReceivedCheqe + '' '' +isnull(case when @CultureNo = 1 then  rbd.Description else rbd.Description2 end,'''')+'' ''+isnull(rbd.Number,'''')+'' ''+ isnull(case when @CultureNo = 1 then b.Title else b.Title2 end,'''') +'' ''+isnull(cfg.getclrsaturndate(rbd.Date,@DateFormat,0,@DateType),''''),
				@ReceivedCheqe+'' '' + case when @CultureNo = 1 then i.Description else i.Description2 end,
				rbd.Number,
				0 [Debit],
				rs.Amount  [Credit],
				rs.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				-rs.Amount Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				-rs.Amount Received,
				0 Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.ReceiveReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceivedCheqe rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Bank b ON b.BankID = rbd.BankID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rbd.ReceivedCheqeID
		 join cfg.party p on p.dlid = rs.dlid
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		LEFT JOIN #OperationLevelAccessUser olau ON olau.userid = i.Creator
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  i.[Status] <> 1 and RT.Type in (1,2,3,4)
		and i.DeliverChequeID is null
		and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	
	EXECUTE sp_executeSQL
				@Query,
				N'@ReceivedCheqe nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@DateFormat nvarchar(10),@DateType tinyint',
				@ReceivedCheqe = @ReceivedCheqe,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@CultureNo = @CultureNo,
				@user=@user,
				@DateFormat = @DateFormat,
				@DateType = @DateType
				
	set @Query = N'
	insert into '+@TableName+'
	SELECT	i.ReceiveReceiptID DocumentID,
	    ''FinanceManager.ReceiveReceipt'' EngName,
		case when RT.Type in (1,2,3) then ''Customer''
				else ''Vendor'' end [Type],
			i.Date,
			@ReceivedCash + '' '' +isnull(case when @CultureNo = 1 then  rbd.Description else rbd.Description2 end,''''),
			@ReceivedCash+'' '' + case when @CultureNo = 1 then i.Description else i.Description2 end,
			i.Number,
			0 [Debit],
			rs.Amount  [Credit],
			rs.CurrencyID,
			p.PartyID,
			null StuffCode,
			null StuffTitle,
			0 MainQuantity,
			NULL SubQuantity,
			0 Fee,
			-rs.Amount Price,
			0 Discount,
			0 Vat,
			0 SalePurchase,
			0 Returned,
			-rs.Amount Received,
			0 Payed,
			NULL AS StuffID,
i.CreationDate
		FROM fin.ReceiveReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		JOIN fin.ReceivedCash rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		join fin.ReceiveSubject RS on RS.ReceivedCashID = rbd.ReceivedCashID
		join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		join cfg.party p on p.dlid = rs.dlid
	INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
	where  RT.Type in (1,2,3,4)
	and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
	and  (@PartyID is null or p.PartyID = @PartyID)
	and
	((@FromDate is null and i.date < @ToDate)
	or
	(@FromDate is not null and i.date between @FromDate and @ToDate)
	)		'
	
	EXECUTE sp_executeSQL
				@Query,
				N'@ReceivedCash nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int,@CultureNo int',
				@ReceivedCash = @ReceivedCash,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user,
				@CultureNo = @CultureNo

	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.ReceiveReceiptID DocumentID,
	       ''FinanceManager.ReceiveReceipt'' EngName,
		   ''Customer'' [Type],
				i.Date,
				@DiscountInReceiveReceipt ,
				@DiscountInReceiveReceipt,
				i.Number,
				0 [Debit],
				rcfi.Discount [Credit],
				rcfi.CurrencyID,
				P.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				0 Price,
				-rcfi.Discount Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				0 Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.ReceiveReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceiveSubject rcfi ON rcfi.ReceiveReceiptID = i.ReceiveReceiptID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = rcfi.ReceiptTypeID
		join cfg.Party P on P.DlID = rcfi.DlID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  rcfi.Discount	> 0  and  RT.Type in (1,2,3,4)
		and (@CurrencyID is null or rcfi.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'

	EXECUTE sp_executeSQL
				@Query,
				N'@DiscountInReceiveReceipt nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@DiscountInReceiveReceipt = @DiscountInReceiveReceipt,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user

	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.ReceiptCheqeFlowID DocumentID,
				''FinanceManager.DrawBackReceivedCheqe'' EngName,
				case when RT.Type in (1,2,3) then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@DrawBackReceivedCheqe,
				@DrawBackReceivedCheqe,
				rc.Number,
				rs.Amount [Debit],
				0 [Credit],
				rs.CurrencyID,
				P.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				rs.Amount  Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				rs.Amount Received,
				0 Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.ReceiptCheqeFlow i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party P on P.DlID = RS.DlID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		 where  i.[Type] in (1,11) and  RT.Type in (1,2,3,4)
		and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	EXECUTE sp_executeSQL     
				@Query,
				N'@DrawBackReceivedCheqe nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@DrawBackReceivedCheqe = @DrawBackReceivedCheqe,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user

	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.ReceiptCheqeFlowID DocumentID,
	       ''FinanceManager.DrawBackReceivedCheqe'' EngName,
		   case when PT.Type = 2 then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@ReturnOfSpendedReceivedCheqe +'' '' + case when @CultureNo = 1 then b.Title else b.Title2 End + '' ''+ rc.Number ,
				@ReturnOfSpendedReceivedCheqe,
				rc.[Number],
				0 [Debit],
				PS.Amount  [Credit],
				PS.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				-PS.Amount  Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				-PS.Amount Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.ReceiptCheqeFlow i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join Cfg.Bank b on rc.BankID=b.BankID
		 join fin.PaymentOtherCheqe POC on POC.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentSubject PS on PS.PaymentOtherCheqeID = POC.PaymentOtherCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
		where  i.[Type] = 4
		and rcfi.PreviousFlow = poc.ReceiptCheqeFlowItemID
		and PT.Type in (1,2,10,12)
		and (@CurrencyID is null or ps.CurrencyID = @CurrencyID)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'

	EXECUTE sp_executeSQL     
				@Query,
				N'@ReturnOfSpendedReceivedCheqe nvarchar(max),@CurrencyID int,@CultureNo TinyInt,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@ReturnOfSpendedReceivedCheqe = @ReturnOfSpendedReceivedCheqe,
				@CurrencyID = @CurrencyID,
				@CultureNo = @CultureNo,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
					@user=@user

	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.PaymentReceiptID DocumentID,
	       ''FinanceManager.PaymentReceipt'' EngName,
		   case when PT.Type = 2 then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@Payment+'' ''+isnull(case when @CultureNo = 1 then  rcfi.Description else rcfi.Description2 end,'''') +'' ''+isnull(pc.Number,'''')+isnull(rc.Number,'''')+'' ''+ isnull(case when @CultureNo = 1 then b.Title else b.Title2 end,'''') + isnull(case when @CultureNo = 1 then b2.Title else b2.Title2 end,'''')+'' ''+isnull(cfg.getclrsaturndate(rc.Date,@DateFormat,0,@DateType),'''')+isnull(cfg.getclrsaturndate(pc.Date,@DateFormat,0,@DateType),'''')   ,
				@Payment+'' '' + case when @CultureNo = 1 then i.Description else i.Description2 end  ,
				i.Number,
				rcfi.Amount ,
				0,
				rcfi.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				rcfi.Amount  Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				rcfi.Amount  Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.PaymentReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 left join fin.PaymentCheqe pc on rcfi.PaymentCheqeID=pc.PaymentCheqeID
		 left join cfg.BankAccount ba on pc.BankAccountID = ba.BankAccountID
		 left join cfg.BankBranch bb on ba.BankBranchID = bb.BankBranchID
		 left join cfg.Bank b on bb.BankID = b.BankID
		 left join fin.PaymentOtherCheqe poc on rcfi.PaymentOtherCheqeid = poc.PaymentOtherCheqeID
		 LEFT JOIN FIN.ReceivedCheqe AS rc	ON rc.ReceivedCheqeID = poc.ReceivedCheqeID
		 LEFT JOIN cfg.Bank AS b2 ON b2.BankID = rc.BankID
		 join cfg.party p on p.dlid = rcfi.dlid
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  i.[Status] = 0
		and PT.Type in (1,2,3,10,12)
		and (@CurrencyID is null or rcfi.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	
	EXECUTE sp_executeSQL
				@Query,
				N'@Payment nvarchar(max),@CurrencyID int,@CultureNo TinyInt,@PartyID bigint,@FromDate Date,@ToDate Date,@user int,@DateFormat nvarchar(10),@DateType tinyint',
				@Payment = @Payment,
				@CurrencyID = @CurrencyID,
				@CultureNo = @CultureNo,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user,
				@DateFormat = @DateFormat,
				@DateType = @DateType

	set @Query = N'
		insert into '+@TableName+'
		SELECT 		i.PaymentReceiptID DocumentID,
	       ''FinanceManager.PaymentReceipt'' EngName,
		   ''Vendor'' [Type],
				i.Date,
				@DiscountInPaymentReceipt ,
				@Payment ,
				i.Number,
				rcfi.Discount,
				0,
				rcfi.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				0 Price,
				rcfi.Discount Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				0 Payed, 
				NULL AS StuffID,
i.CreationDate
		 FROM fin.PaymentReceipt i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		 join cfg.party p on p.dlid = rcfi.dlid
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  rcfi.Discount	> 0 
		and i.[Status] = 0
		and PT.Type in (1,2,3,10,12)
		and (@CurrencyID is null or rcfi.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
		
	EXECUTE sp_executeSQL     
				@Query,
				N'@DiscountInPaymentReceipt nvarchar(max),@Payment nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@DiscountInPaymentReceipt = @DiscountInPaymentReceipt,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user,
				@Payment = @Payment
					
	set @Query = N'
		insert into '+@TableName+'
		SELECT 	i.PaymentCheqeFlowID DocumentID,
	       ''FinanceManager.DrawBackPaymentCheqe'' EngName,
		    case when PT.Type = 2 then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@DrawBackPaymentCheqe,
				@DrawBackPaymentCheqe,
				null,
				0,
				PS.Amount - PS.Discount,
				PS.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				-(PS.Amount - PS.Discount) Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				-(PS.Amount - PS.Discount) Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.PaymentCheqeFlow i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PaymentCheqeFlowItem rbd ON rbd.PaymentCheqeFlowID = i.PaymentCheqeFlowID
		 join FIN.PaymentCheqe pc on pc.PaymentCheqeID = rbd.PaymentCheqeID
		 join fin.PaymentSubject PS on PS.PaymentCheqeID = PC.PaymentCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		 join cfg.Party P on P.DlID = PS.DLID and p.PartyID = i.PartyID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  PT.Type in (1,2,3,10,12)
		AND I.Type = 1
		and (@CurrencyID is null or ps.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	EXECUTE sp_executeSQL     
				@Query,
				N'@DrawBackPaymentCheqe nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@DrawBackPaymentCheqe = @DrawBackPaymentCheqe,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@user=@user

	set @Query = N'
		insert into '+@TableName+'
	SELECT 	h.DebitCreditNoteID DocumentID,
	       ''ReportGenerator.DebitCreditNote'' EngName,
			case when rt.ReceiptTypeID is not null and rt.Type in (1,2,3) 
							then ''Customer''
						when rt.ReceiptTypeID is not null and rt.Type = 4
							then ''Vendor''
						when pt.PaymentTypeID is not null and pt.Type = 2
							then ''Customer''
						when pt.PaymentTypeID is not null and pt.Type in (1,3,10,12)
							then ''Vendor''
					end [Type],
			    h.Date,
			    case when @CultureNo = 1 then i.description else i.description2 end ,
				case when @CultureNo = 1 then h.description else h.description2 end ,
			    h.Number,
			    case when i.type = 0 then i.amount - i.Discount else 0 end,
			    case when i.type = 1 then i.amount - i.Discount else 0 end,
			    i.CurrencyID,
			    i.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				case when i.type = 0 then i.amount - i.Discount else -(i.amount - i.Discount) end  Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
			    case when (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4))
						then (case when i.Type = 0 then i.Amount else -i.Amount end)
					 else 0
						end Received,
			    case when  (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10,12))
						 then (case when i.Type = 0 then i.Amount else -i.Amount end)
					 else 0
						 end  Payed,
				NULL AS StuffID,
h.CreationDate
	from cfg.DebitCreditNote h
			 join #vwBranchAccess vba on h.BranchID = vba.BranchID
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
	where ( (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
			or
			(pt.PaymentTypeID is not null and pt.Type in (1,2,3,10,12))
		  )
		and (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and h.date < @ToDate)
		or
		(@FromDate is not null and h.date between @FromDate and @ToDate)
		)		'
	EXECUTE sp_executeSQL     
				@Query,
				N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int',
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@CultureNo = @CultureNo,
					@user=@user

	set @Query = N'
		insert into '+@TableName+'
	SELECT 	h.DebitCreditNoteID DocumentID,
	       ''ReportGenerator.DebitCreditNote'' EngName,
			   case when rt.ReceiptTypeID is not null and rt.Type in (1,2,3) 
						then ''Customer''
					when rt.ReceiptTypeID is not null and rt.Type = 4
						then ''Vendor''
					when pt.PaymentTypeID is not null and pt.Type = 2
						then ''Customer''
					when pt.PaymentTypeID is not null and pt.Type in (1,3,10,12)
						then ''Vendor''
				end [Type],
			    h.Date,
				case when @CultureNo = 1 then i.description else i.description2 end,	
				case when @CultureNo = 1 then h.description else h.description2 end,	
				h.Number,
				case when i.type = 0 then  i.Discount else 0 end,
				case when i.type = 1 then  i.Discount else 0 end,
				i.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				0 Price,
				case when i.type = 1 then  i.Discount else -i.Discount  end Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				case when i.type = 1 then  -i.Discount else 0 end Received,
				case when i.type = 0 then  -i.Discount else 0 end Payed,
				NULL AS StuffID,
h.CreationDate
	from cfg.DebitCreditNote h
			 join #vwBranchAccess vba on h.BranchID = vba.BranchID
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
	where  (
	(rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
	or
		 (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10,12))
		 )
		 and i.Discount > 0
		and (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and h.date < @ToDate)
		or
		(@FromDate is not null and h.date between @FromDate and @ToDate)
		)		'
	EXECUTE sp_executeSQL
				@Query,
				N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int',
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@CultureNo = @CultureNo,
				@user=@user

	set @Query = N'
		insert into '+@TableName+'
		SELECT 		i.PettyCashCostID DocumentID,
	       ''FinanceManager.PettyCashCost'' EngName,
		   case when PT.Type = 2 then ''Customer''
					else ''Vendor'' end [Type],
				i.Date,
				@PaymentInPettyCash,
				@PaymentInPettyCash,
				i.Number,
				rcfi.Amount,
				0,
				pc.CurrencyID,
				rcfi.PartyID,
				null StuffCode,
				null StuffTitle,
				0 MainQuantity,
				0 SubQuantity,
				0 Fee,
				rcfi.Amount Price,
				0 Discount,
				0 Vat,
				0 SalePurchase,
				0 Returned,
				0 Received,
				rcfi.Amount Payed,
				NULL AS StuffID,
i.CreationDate
		 FROM fin.PettyCashCost i
			 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PettyCashCostItem rcfi ON rcfi.PettyCashCostID = i.PettyCashCostID
		 join fin.PettyCash pc on pc.PettyCashID = i.PettyCashID
		 JOIN cfg.Currency c ON c.CurrencyID = pc.CurrencyID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on rcfi.PartyID=vpa.PartyID
		where  PT.Type in (1,2,10,12)
		and (@CurrencyID is null or pc.CurrencyID = @CurrencyID)
		and  (@PartyID is null or rcfi.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		'
	
	EXECUTE sp_executeSQL
				@Query,
				N'@PaymentInPettyCash nvarchar(max),@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@user int',
				@PaymentInPettyCash = @PaymentInPettyCash,
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
					@user=@user

	declare @CostOfOrder nvarchar(256)
	SELECT @CostOfOrder = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'CostOfOrder'
	       AND lev.Culture = @Culture

		set @Query = N'
		insert into '+@TableName+'
		SELECT 	c.CostOfOrderid DocumentID,
	       ''ForeignOrder.CostOfOrder'' EngName,
		   ''Vendor''  [Type],
				c.Date,
				case when @CultureNo = 1 then s.Title else s.Title2 end ,
				@CostOfOrder,
				c.Number,
				0,
				i.Amount,
				-1,
				i.PartyID,
				null StuffCode,
				s.Title StuffTitle,
				0 MainQuantity,
				NULL SubQuantity,
				0 Fee,
				-i.Amount Price,
				0 Discount,
				0 Vat,
				-i.Amount SalePurchase,
				0 Returned,
				0 Received,
				0 Payed,
				NULL AS StuffID,
C.CreationDate
		 FROM fos.CostOfOrder c
			 join #vwBranchAccess vba on c.BranchID = vba.BranchID
		 join fos.CostOfOrderItem i on c.CostOfOrderid = i.CostOfOrderID
		 join fos.SpecialCost s on s.SpecialCostID = i.SpecialCostID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
		where  i.PartyID is not null
		and i.PurchaseInvoiceItemID is null
		and  (@CurrencyID is null or @CurrencyID = -1)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and c.date < @ToDate)
		or
		(@FromDate is not null and c.date between @FromDate and @ToDate)
		)	'
		

	EXECUTE sp_executeSQL     
				@Query,
				N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@CostOfOrder nvarchar(256)',
				@CurrencyID = @CurrencyID,
				@PartyID = @PartyID,
				@FromDate = @FromDate,
				@ToDate = @ToDate,
				@CultureNo = @CultureNo,
				@user=@user,
				@CostOfOrder = @CostOfOrder
	
	-------------------PosInvoice--------------------
	IF @Type<>'Vendor'
	BEGIN
	
		set @Query = N'
			insert into '+@TableName+'
			SELECT
					i.PosInvoiceID DocumentID,
					''StoreSale.PosInvoice'' EngName,
					''Customer'' [Type],
					i.Date,
					@PosInvoice Description ,
					@PosInvoice ,
					i.Number,
					vi.Price - vi.Discount+vi.Tax+vi.Duty [Debit] ,
					0 [Credit],
					-1,
					I.CustomerID PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
					vi.MainQuantity MainQuantity,
					vi.SubQuantity SubQuantity,
					vi.Fee Fee,
					vi.Price Price,
					-vi.Discount Discount,
					vi.tax + vi.Duty Vat,
					vi.Price SalePurchase,
					0 Returned,
					0 Received,
					0 Payed,
					NULL AS StuffID,
i.CreationDate
			 FROM pos.PosInvoice AS i
			join pos.StationShift AS ss on ss.StationShiftID = i.StateShiftID
			join pos.Station AS st on st.StationID = ss.StationID			
			 join #vwBranchAccess vba on st.BranchID = vba.BranchID
			 JOIN POS.PosInvoiceItem Vi on Vi.PosInvoiceID = i.PosInvoiceID
			 JOIN #Stuff s on s.StuffID = vi.StuffID
			 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
			where  i.[Status] = 1
			and i.IsReturnInvoice = 0
			and  (@PartyID is null or I.CustomerID = @PartyID)
			 and i.date between @FromDate and @ToDate
			'
			
		EXECUTE sp_executeSQL     
					@Query,
					N'@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@Posinvoice NVARCHAR(MAX)',
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
					@user=@user,
					@PosInvoice = @PosInvoice
	
		set @Query = N'
			insert into '+@TableName+'
			SELECT
					i.PosInvoiceID DocumentID,
					case when i.IsReturnInvoice = 1 then ''StoreSale.PosReturnInvoice'' else ''StoreSale.PosInvoice'' end EngName,
					''Customer'' [Type],
					i.Date,
					ve.[Value]  as Description ,
					ve.[Value] ,
					i.Number,
					0 [Debit] ,
					vi.Price - vi.Discount+vi.Tax+vi.Duty [Credit],
					-1,
					I.CustomerID PartyID,
					s.Code StuffCode,
					case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
					-vi.MainQuantity MainQuantity,
					CASE WHEN vi.SubQuantity IS NOT NULL THEN -vi.SubQuantity ELSE NULL END  SubQuantity,
					vi.Fee Fee,
					-vi.Price Price,
					vi.Discount Discount,
					-(vi.tax + vi.Duty) Vat,
					-vi.Price SalePurchase,
					0 Returned,
					0 Received,
					0 Payed,
					NULL AS StuffID,
i.CreationDate
			 FROM POS.PosInvoice i
			join pos.StationShift AS ss on ss.StationShiftID = i.StateShiftID
			join pos.Station AS st on st.StationID = ss.StationID			
			 join #vwBranchAccess vba on st.BranchID = vba.BranchID
			 join #vwEnums ve on (case when i.IsReturnInvoice = 1 then ''ReturnPosInvoice'' else ''PosInvoice'' end) = ve.Item
			 JOIN POS.PosInvoiceItem Vi on Vi.PosInvoiceID = i.PosInvoiceID
			 JOIN #Stuff s on s.StuffID = vi.StuffID
			 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
			where  i.[Status] = 1
			and i.IsReturnInvoice = 1
			and  (@PartyID is null or I.CustomerID = @PartyID)
			 and i.date between @FromDate and @ToDate
			'

		EXECUTE sp_executeSQL     
					@Query,
					N'@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@Posinvoice NVARCHAR(MAX)',
					@PartyID = @PartyID,
					@FromDate = @FromDate,
					@ToDate = @ToDate,
					@CultureNo = @CultureNo,
					@user=@user,
					@PosInvoice = @PosInvoice
				SELECT * into #vwEnumItemType
				FROM cfg.VwEnums AS ve WHERE ve.Enum = 'ItemType'
				
			set @Query = N'
			insert into '+@TableName+'
			SELECT	 pr.PosReceiptID DocumentID,
					''StoreSale.PosReceipt'' EngName,
					''Customer'' [Type],
					pr.[Date],
				isnull(veit.Value,'''')+'' ''+pr.[Description]+ '' ''+isnull(veit.Value,'''') + case when pri.ItemType = 5 then N'' چک شماره: '' + isnull(pri.TracingNumber,'''')+N''بانک: '' +bnk.Title else '''' End   ,
					@PosReceipt ,
					pr.Number,
					CASE WHEN pri.IsPayed = 1 THEN pri.Amount * pri.CurrencyRate ELSE 0 end [Debit] ,
					CASE WHEN pri.IsPayed = 0 THEN pri.Amount * pri.CurrencyRate ELSE 0 end [Credit],
					-1,
					pr.CustomerID PartyID,
					Null StuffCode,
					NULL StuffTitle,
					0 MainQuantity,
					NULL SubQuantity,
					0 Fee,
					0 Price,
					0 Discount,
					0 Vat,
					0 SalePurchase,
					0 Returned,
					CASE WHEN pri.IsPayed = 0 THEN pri.Amount * pri.CurrencyRate ELSE 0 end Received,
					CASE WHEN pri.IsPayed = 1 THEN pri.Amount * pri.CurrencyRate ELSE 0 end  Payed ,
					NULL AS StuffID,
PR.CreationDate
			FROM pos.PosReceipt AS pr
     join pos.StationShift AS ss on ss.StationShiftID = pr.StationShiftID
     join pos.Station AS st on st.StationID = ss.StationID     
			 join #vwBranchAccess vba on st.BranchID = vba.BranchID
			 JOIN pos.PosReceiptItem AS pri ON pri.PosReceiptID = pr.PosReceiptID
			 left join #vwEnumItemType veit on pri.ItemType = veit.KeyValue
			 left join cfg.Bank bnk on pri.BankID = bnk.BankID
			 where   (@PartyID is null or pr.CustomerID = @PartyID)
			 and pr.date between @FromDate and @ToDate
			 
			 	 
			 '
				
		EXECUTE sp_executeSQL
		@Query,
		N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@PosReceipt NVARCHAR(MAX)',
		@CurrencyID = @CurrencyID,
		@PartyID = @PartyID,
		@FromDate = @FromDate,
		@ToDate = @ToDate,
		@CultureNo = @CultureNo,
		@user=@user,
		@PosReceipt = @PosReceipt	
	END

	set @Query = N'
	insert into '+@TableName+'
	SELECT	 pr.PosReceiptID DocumentID,
			''StoreSale.PosReceipt'' EngName,
			''Customer'' [Type],
			pr.[Date],
			@PosReceipt+'' ''+pr.[Description] ,
			@PosReceipt,
			pr.Number,
			CASE WHEN pr.IsPayed = 0 THEN 0  ELSE pr.Discount end [Debit] ,
			CASE WHEN pr.IsPayed = 0 THEN pr.Discount  ELSE 0 end as Credit,
			-1,
			pr.CustomerID PartyID,
			Null StuffCode,
			NULL StuffTitle,
			0 MainQuantity,
			NULL SubQuantity,
			0 Fee,
			-0 Price,
			CASE WHEN pr.IsPayed = 0 THEN -pr.Discount ELSE pr.Discount END Discount,
			0 Vat,
			0 SalePurchase,
			0 Returned,
			CASE WHEN pr.IsPayed = 0 THEN pr.Discount ELSE 0 end Received,
			0   Payed,
			NULL AS StuffID,
pr.CreationDate
		FROM pos.PosReceipt AS pr
     join pos.StationShift AS ss on ss.StationShiftID = pr.StationShiftID
     join pos.Station AS st on st.StationID = ss.StationID     
	 join #vwBranchAccess vba on st.BranchID = vba.BranchID
		where   (@PartyID is null or pr.CustomerID = @PartyID)
		and pr.Discount<>0
		and pr.date between @FromDate and @ToDate
		
		'
				
	EXECUTE sp_executeSQL     
		@Query,
		N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date,@CultureNo TinyInt,@user int,@PosReceipt NVARCHAR(MAX)',
		@CurrencyID = @CurrencyID,
		@PartyID = @PartyID,
		@FromDate = @FromDate,
		@ToDate = @ToDate,
		@CultureNo = @CultureNo,
		@user=@user,
		@PosReceipt = @PosReceipt

