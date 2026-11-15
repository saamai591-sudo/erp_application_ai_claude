	
CREATE   PROCEDURE [FIN].spReceiveReceiptPreVoucherInsert
	@ReceiveReceiptId NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'ReceiveReceipt'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'ReceiveReceipt'),
				@MaxPrevoucherID int,
				@BaseDigit INT,
				@CreatorId int,
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@BankDraftDescription  nvarchar(max),
				@BankDraftDescription2 nvarchar(max),
				@CashDescription  nvarchar(max),
				@CashDescription2 nvarchar(max),
				@ChequeDescription  nvarchar(max),
				@ChequeDescription2 nvarchar(max),
				@SubjectDescription  nvarchar(max),
				@SubjectDescription2 nvarchar(max),
				@DiscountDescription nvarchar(max),
				@DiscountDescription2 nvarchar(max),
				@CurrencyExchangeDescription NVARCHAR(MAX),
				@CurrencyExchangeDescription2 NVARCHAR(MAX),
				@SomeItemsSlNotSet nvarchar(max),
				@ProfitAndLossSlNotSet nvarchar(max),
				@Culture nvarchar(10),
				@BankAccountDlTypeID int

		SET @Culture = cfg.GetuserCulture()
		
		SELECT @SomeItemsSlNotSet = i.[Value]  
		FROM cfg.LocalizationSQLMessage h
		JOIN cfg.LocalizationSQLMessageValue i 
			ON h.LocalizationSQLMessageID = i.LocalizationSQLMessageID
		WHERE SQLMessageCode = 'SomeItemsSlNotSet' AND i.Culture = @Culture

		SELECT @ProfitAndLossSlNotSet = i.[Value]  
		FROM cfg.LocalizationSQLMessage h
		JOIN cfg.LocalizationSQLMessageValue i 
			ON h.LocalizationSQLMessageID = i.LocalizationSQLMessageID
		WHERE SQLMessageCode = 'ProfitAndLossSlNotSet' AND i.Culture = @Culture

		SET @CreatorId = CFG.GetuserID();
		set @BaseDigit = cfg.GetBaseCurrencyPrecision();	            

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReceiveReceiptId) 		

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @BankDraftDescription = Description,
				@BankDraftDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'BankDraft'

		select  @CashDescription = Description,
				@CashDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cash'

		select  @ChequeDescription = Description,
				@ChequeDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cheque'

		select  @SubjectDescription = Description,
				@SubjectDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Subject'
	    
		select  @DiscountDescription = Description,
				@DiscountDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Discount'

		SELECT @CurrencyExchangeDescription = Description,
			   @CurrencyExchangeDescription2 = Description2
		FROM CFG.[VoucherDescription] 
		WHERE MDEntityID = @MDEntity AND [Key] = 'CurrencyExchange'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
		
		SELECT @BankAccountDlTypeID = DlTypeID FROM acc.DlType AS dt
		WHERE dt.Code = 100

	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by rr.ReceiveReceiptid) PrevoucherID,
				rr.ReceiveReceiptid,
			    DlID   ,
				rr.BranchID,
				rr.FinancialPeriodID,
				rr.Status,
				rr.Number ,
				rr.Date,
				cast(null as varchar(max)) ErrorMessage ,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				@HeaderDescription  Description,
				@HeaderDescription2 Description2,
				p.Title + ISNULL(' '+LastName,'') PartyTitle,
				p.Title2 + ISNULL(' '+LastName2,'') PartyTitle2,
			    rr.Description BaseDescription,
				rr.Description2 BaseDescription2
			into #ReceiveReceipt
	    FROM   FIN.ReceiveReceipt rr 
		JOIN #DocumentIds b on rr.ReceiveReceiptID = b.ID
	    INNER JOIN cfg.party p  ON  rr.PartyID = p.PartyID 
		JOIN cfg.DimDate DD on DD.Date = rr.Date
	    WHERE rr.PreVoucherID is null
	    
		update a
		set ErrorMessage = N'Messages.FIN_spPaymentReceiptPreVoucherInsert_2'+char(10)+char(13)
		from #ReceiveReceipt a
		where Status = 1

		if exists (select 1 from #ReceiveReceipt where ErrorMessage is not null )
		BEGIN	
			select ReceiveReceiptid,ErrorMessage from #ReceiveReceipt
			RETURN;
	    END

		CREATE TABLE #DocItems
		(
		BaseDocumentName varchar(256),
		BaseDocumentID int,
		ReceiveReceiptID int,
		PreVoucherID int,
		CurrencyID INT,
		CurrencyRate DECIMAL(30,4),
		Amount DECIMAL(30,4),
		AmountInBaseCurrency DECIMAL(30,4),
		RoundedAmountInBaseCurrency DECIMAL(36,10),
		SlID INT,
		DlID INT,
		DESCRIPTION nvarchar(max),
		DESCRIPTION2 nvarchar(max),
		CashDlIDForCheck int,
		RowIndex int
		)
			 	
		INSERT INTO #DocItems 
		SELECT  'ReceivedBankDraft',
				ReceivedBankDraftID,
				rr.ReceiveReceiptID,
				PreVoucherID,
				RBD.CurrencyID,
				RBD.CurrencyRate,			
				Amount,
				case when c.IsBaseCurrencyBasis = 0
				then ROUND(Amount * RBD.CurrencyRate / c.exchangeunit , @BaseDigit)
					 when c.IsBaseCurrencyBasis = 1
				then ROUND(Amount * c.exchangeunit  / RBD.CurrencyRate , @BaseDigit)
					end  ,
				0,
				ba.SlID,
				ba.DlID,
				REPLACE(
				REPLACE(@BankDraftDescription
				,'@@TraceNumber@@',rbd.Number)
				,'@@ItemDescription@@',isnull(rbd.[Description],'')),
				REPLACE(
				REPLACE(@BankDraftDescription2
				,'@@TraceNumber@@',rbd.Number)
				,'@@ItemDescription@@',isnull(rbd.[Description2],'')),
				null,
				RBD.RowIndex
		from FIN.ReceivedBankDraft RBD
		join #ReceiveReceipt rr on rr.ReceiveReceiptID = rbd.ReceiveReceiptID
		JOIN cfg.BankAccount ba ON ba.BankAccountID = RBD.BankAccountID
		JOIN cfg.Currency AS c ON c.CurrencyID = RBD.CurrencyID
	
		INSERT INTO #DocItems 
		SELECT  'ReceivedCash',
				rc.ReceivedCashID,
				rr.ReceiveReceiptID,
				PreVoucherID,
				RC.CurrencyID,
				RC.CurrencyRate,
				Amount,
				case when c2.IsBaseCurrencyBasis = 0
				then ROUND(Amount * RC.CurrencyRate / c2.exchangeunit , @BaseDigit)
					 when c2.IsBaseCurrencyBasis = 1
				then ROUND(Amount * c2.exchangeunit  / RC.CurrencyRate , @BaseDigit)
					end  ,
				0,
				cb.SlID,
				c.DlID,
				REPLACE(@CashDescription,'@@ItemDescription@@',isnull(rc.[Description],'')),
				REPLACE(@CashDescription,'@@ItemDescription@@',isnull(rc.[Description2],'')),
				null,
				RC.RowIndex
		from FIN.ReceivedCash RC
		join #ReceiveReceipt rr on rr.ReceiveReceiptID = rc.ReceiveReceiptID
		JOIN cfg.Cash c ON c.CashID = RC.CashID
		JOIN cfg.Currency AS c2 ON c2.CurrencyID = RC.CurrencyID
		left join cfg.CashBalance cb on cb.CashID = c.CashID and cb.CurrencyID = rc.CurrencyID	

		INSERT INTO #DocItems 
		SELECT  'ReceivedCheqe',
				rc.ReceivedCheqeID,
				rr.ReceiveReceiptID,
				PreVoucherID,
				rc.CurrencyID,
				CurrencyRate,
				Amount,
				case when c.IsBaseCurrencyBasis = 0
				then ROUND(Amount * RC.CurrencyRate / c.exchangeunit , @BaseDigit)
					 when c.IsBaseCurrencyBasis = 1
				then ROUND(Amount * c.exchangeunit  / RC.CurrencyRate , @BaseDigit)
					end  ,
				0,
				CASE WHEN Commercial = 1
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'ReceivedDocumentSl')
					 WHEN Commercial = 0
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'OtherReceivedDocumentSl')
				END AS SlID,
				rr.DlID,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@ChequeDescription
				,'@@GregorianDueDate@@',dd.FullDateAlternateKey)				
				,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
				,'@@ChequeNumber@@',rc.Number)
				,'@@ItemDescription@@',isnull(rc.[Description],'')),
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@ChequeDescription2
				,'@@GregorianDueDate@@',dd.FullDateAlternateKey)				
				,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
				,'@@ChequeNumber@@',rc.Number)
				,'@@ItemDescription@@',isnull(rc.[Description2],''))
				,ca.DlID
				,rc.RowIndex
		from FIN.ReceivedCheqe RC
		join #ReceiveReceipt rr on rr.ReceiveReceiptID = rc.ReceiveReceiptID
		JOIN cfg.Currency AS c ON c.CurrencyID = RC.CurrencyID
		join cfg.dimdate dd on dd.date = rc.date
		join cfg.cash ca on ca.CashID = rc.CashID

		update b
		set ErrorMessage =  @SomeItemsSlNotSet + char(10) + char(13)
		from #DocItems a
		left join #ReceiveReceipt b on a.ReceiveReceiptID = b.ReceiveReceiptID
		where a.SlID is null

		if exists (select 1 from #ReceiveReceipt where ErrorMessage is not null )
		BEGIN	
			select ReceiveReceiptid,ErrorMessage from #ReceiveReceipt
			RETURN;
	    END

		CREATE TABLE #ReceiveSubjects
				(
				ReceiveSubjectID INT,
				ReceiveReceiptID int,
				PreVoucherId int,
				CurrencyID INT,
				CurrencyRate DECIMAL(30,4),
				Amount DECIMAL(30,4),
				AmountInBaseCurrency DECIMAL(30,4),
				RoundedAmountInBaseCurrency DECIMAL(36,10),
				SlID INT,
				DLID bigint,
				DlTypeID int,
				Discount DECIMAL(30,4),
				DiscountInBaseCurrency DECIMAL(30,4),			
				SubjectDescription nvarchar(max),
				SubjectDescription2 nvarchar(max),
				DiscountDescription nvarchar(max),
				DiscountDescription2 nvarchar(max),
				ReceiptTypeID int,
				RowIndex INT,
				BankAccountDlID BIGINT,
				)
	     	
		INSERT INTO #ReceiveSubjects
				SELECT 
				ReceiveSubjectID ,
				rr.ReceiveReceiptID,
				rr.PreVoucherId,
				rs.CurrencyID,
				rs.CurrencyRate,
				rs.Amount,
				case when c.IsBaseCurrencyBasis = 0
				then rs.Amount * rs.CurrencyRate / c.exchangeunit --ROUND(rs.Amount * rs.CurrencyRate / c.exchangeunit , @BaseDigit)
					 when c.IsBaseCurrencyBasis = 1
				then rs.Amount * c.exchangeunit  / rs.CurrencyRate --ROUND(rs.Amount * c.exchangeunit  / rs.CurrencyRate , @BaseDigit)
				end  ,
				0,
				case when SaleType.SlID is not null then SaleType.SlID
					 when PurchaseType.SlID is not null then PurchaseType.SlID
					 when PurchaseType2.SlID is not null then PurchaseType2.SlID
					 when SaleType2.SlID is not null then SaleType2.SlID
					 else r.SLID end,
				rs.DLID,
				dl.DlTypeID,
				rs.Discount,
				case when c.IsBaseCurrencyBasis = 0
						then Discount * rs.CurrencyRate / c.exchangeunit --ROUND(Discount * rs.CurrencyRate / c.exchangeunit , @BaseDigit)
					 when c.IsBaseCurrencyBasis = 1
						then Discount * c.exchangeunit  / rs.CurrencyRate --ROUND(Discount * c.exchangeunit  / rs.CurrencyRate , @BaseDigit)
					 end  ,
				REPLACE(
				           REPLACE(
				               REPLACE(
				                   REPLACE(
				                       dsc.[Description],
				                       '@@ItemDescription@@',
				                       ISNULL(rs.[Description], '')
				                   ),
				                   '@@ChequeNumber@@',
				                   ISNULL(rc.Number, '')
				               ),
				               '@@GregorianDueDate@@',
				               ISNULL(dd.FullDateAlternateKey, '')
				           ),
				           '@@SolarDueDate@@',
				           ISNULL(dd.PersianFullDateAlternateKey, '')
				       ),
				REPLACE(
				           REPLACE(
				               REPLACE(
				                   REPLACE(
				                       dsc.[Description],
				                       '@@ItemDescription@@',
				                       ISNULL(rs.[Description2], '')
				                   ),
				                   '@@ChequeNumber@@',
				                   ISNULL(rc.Number, '')
				               ),
				               '@@GregorianDueDate@@',
				               ISNULL(dd.FullDateAlternateKey, '')
				           ),
				           '@@SolarDueDate@@',
				           ISNULL(dd.PersianFullDateAlternateKey, '')
				       ),
				@DiscountDescription,
				@DiscountDescription2,
				r.ReceiptTypeID
				,rs.RowIndex,
				ba.DlID BankAccountDlID
				
		FROM FIN.ReceiveSubject rs
		join #ReceiveReceipt rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID
		join fin.ReceiptType r on rs.ReceiptTypeID = r.ReceiptTypeID
		JOIN cfg.Currency AS c ON c.CurrencyID = rs.CurrencyID
		left join acc.dl on dl.DLID = rs.DLID
		left join sle.invoice on invoice.InvoiceID = rs.InvoiceID
		left join sle.SaleType on SaleType.SaleTypeID = invoice.SaleTypeID
		left join vnd.ReturnInvoice on ReturnInvoice.ReturnInvoiceID = rs.ReturnInvoiceID
		left join vnd.PurchaseType on PurchaseType.PurchaseTypeID = ReturnInvoice.Type
		left join vnd.PurchaseInvoice on PurchaseInvoice.PurchaseInvoiceID = rs.PurchaseInvoiceID
		left join vnd.PurchaseType PurchaseType2 on PurchaseType2.PurchaseTypeID = PurchaseInvoice.Type
		left join cfg.InstallmentPaymentItem on InstallmentPaymentItem.InstallmentPaymentItemID = rs.InstallmentPaymentItemID
		left join cfg.InstallmentPayment on InstallmentPayment.InstallmentPaymentID = InstallmentPaymentItem.InstallmentPaymentID
				 and InstallmentPayment.BaseType = 2
		left join sle.invoice invoice2 on invoice2.InvoiceID = InstallmentPayment.DocumentID
		left join sle.SaleType SaleType2  on SaleType2.SaleTypeID = invoice2.SaleTypeID
		left join fin.ReceivedBankDraft AS rbd on rbd.ReceivedBankDraftID = rs.ReceivedBankDraftID
		left join cfg.BankAccount AS ba on ba.BankAccountID = rbd.BankAccountID
		left join fin.ReceivedCheqe AS rc on rc.ReceivedCheqeID = rs.ReceivedCheqeID
		left join cfg.DimDate AS dd on rc.[Date] = dd.[Date]
		left join (SELECT vd.[Key],vd.[Description],vd.Description2 FROM cfg.VoucherDescription AS vd 
		join mdt.DmdEntity AS de on vd.MDEntityID = de.ID
		           WHERE de.Name = 'ReceiveReceipt' and vd.[Key] IN ('SubjectBasedOnBankDraft','SubjectBasedOnCheque','SubjectBasedOnCash')) dsc
		           on CASE WHEN rs.ReceivedCheqeID is NOT NULL then 'SubjectBasedOnCheque' 
		           when rs.ReceivedCashID is NOT NULL then 'SubjectBasedOnCash' 
		           when rs.ReceivedBankDraftID is NOT NULL then 'SubjectBasedOnBankDraft' END = dsc.[Key]


		update a
		set ErrorMessage =  N'FIN_spReceiveReceiptPreVoucherInsert_3^'+cast(Number as varchar(10))+char(10)+char(13)
		from #ReceiveReceipt a
		join 
		(SELECT ReceiveReceiptID,ROUND( SUM(AmountInBaseCurrency ) ,@BaseDigit) AmountInBaseCurrency
		FROM   #ReceiveSubjects 
		group by ReceiveReceiptID) b on a.ReceiveReceiptID = b.ReceiveReceiptID
		join 
		(SELECT ReceiveReceiptID,SUM(AmountInBaseCurrency) AmountInBaseCurrency
		FROM   #DocItems
		group by ReceiveReceiptID) c on c.ReceiveReceiptID = a.ReceiveReceiptID
		where b.AmountInBaseCurrency <> c.AmountInBaseCurrency

		update a
		set ErrorMessage = isnull(ErrorMessage,'')  + N'FIN_spReceiveReceiptPreVoucherInsert_5^'+cast(Number as varchar(10))+char(10)+char(13)
		from #ReceiveReceipt a
		left join #ReceiveSubjects b on a.ReceiveReceiptID = b.ReceiveReceiptID
		where b.ReceiveSubjectID is null

		Declare @DiscountSlID int
	  	SELECT @DiscountSlID = ConfigValue 
	  	                        FROM CFG.Configuration 
	  	                        WHERE ConfigKey = 'SaleDiscountSlID'
	  
		IF @DiscountSlID IS NULL
		BEGIN		
			update a
			set ErrorMessage = isnull(ErrorMessage,'')  + N'FIN_spReceiveReceiptPreVoucherInsert_6^'+cast(Number as varchar(10))+char(10)+char(13)
			from #ReceiveReceipt a
			join #ReceiveSubjects b on a.ReceiveReceiptID = b.ReceiveReceiptID
			where b.Discount > 0
		END

		update a
		set ErrorMessage = isnull(ErrorMessage,'')  + N'FinanceManager.Messages.SlInSubjects'+char(10)+char(13)
		from #ReceiveReceipt a
		join #ReceiveSubjects b on a.ReceiveReceiptID = b.ReceiveReceiptID
		where b.SlID is null

		if exists (select 1 from #ReceiveReceipt where ErrorMessage is not null )
		BEGIN	
			select ReceiveReceiptid,ErrorMessage from #ReceiveReceipt
			RETURN;
	    END

		CREATE TABLE #Allocation
				(
				DebitCreditNoteID int,
				PrevoucherID int,
				DebitCreditNoteItemID INT,
				CurrencyID INT,
				CurrencyRate DECIMAL(36,10),
				Debit DECIMAL(36,10),
				CurrencyDebit DECIMAL(36,10),
				Credit DECIMAL(36,10),
				CurrencyCredit DECIMAL(36,10),
				SlID INT,
				DlID INT,
				Description nvarchar(max),
				Description2 nvarchar(max),
				PreVoucherItemID int,
				RowIndex int
				)

		INSERT INTO #Allocation
		SELECT 
				pr.ReceiveReceiptID,
				pr.PrevoucherID,
				ps.ReceiveSubjectID,
				ps.CurrencyID,
				0,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				0,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				0,
				RT.SLID,
				ps.DlID,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@CurrencyExchangeDescription,
				'@@Date_Gregorian@@',pr.FullDateAlternateKey),
				'@@Date_Solar@@',pr.PersianFullDateAlternateKey),
				'@@Number@@',pr.Number),
				'@@HeaderDescription@@',isnull(pr.BaseDescription,'')),
				'@@PartyTitle@@',pr.PartyTitle),
				'@@ItemDescription@@',isnull(ps.Description,'')),
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@CurrencyExchangeDescription2,
				'@@Date_Gregorian@@',pr.FullDateAlternateKey),
				'@@Date_Solar@@',pr.PersianFullDateAlternateKey),
				'@@Number@@',pr.Number),
				'@@HeaderDescription@@',isnull(pr.BaseDescription2,'')),
				'@@PartyTitle@@',pr.PartyTitle2),
				'@@ItemDescription@@',isnull(ps.Description2,'')),
				null,
				ps.RowIndex
		FROM fin.ReceiveSubject  ps 
		join #ReceiveReceipt pr     on pr.ReceiveReceiptID = ps.ReceiveReceiptID
		join fin.ReceiptType rt on rt.ReceiptTypeID = ps.ReceiptTypeID
		where ps.Allocation <> 0

		INSERT INTO #Allocation
		SELECT 
			pr.ReceiveReceiptID,
			pr.PrevoucherID,
			ps.ReceiveSubjectID,
			-1,
			1,
			case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
			case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
			case when ps.Allocation > 0 then ps.Allocation else 0 end,
			case when ps.Allocation > 0 then ps.Allocation else 0 end,
			RT.AllocationSlID,
			ps.DlID,
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(@CurrencyExchangeDescription,
			'@@Date_Gregorian@@',pr.FullDateAlternateKey),
			'@@Date_Solar@@',pr.PersianFullDateAlternateKey),
			'@@Number@@',pr.Number),
			'@@HeaderDescription@@',isnull(pr.BaseDescription,'')),
			'@@PartyTitle@@',pr.PartyTitle),
			'@@ItemDescription@@',isnull(ps.Description,'')),
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(
			REPLACE(@CurrencyExchangeDescription2,
			'@@Date_Gregorian@@',pr.FullDateAlternateKey),
			'@@Date_Solar@@',pr.PersianFullDateAlternateKey),
			'@@Number@@',pr.Number),
			'@@HeaderDescription@@',isnull(pr.BaseDescription2,'')),
			'@@PartyTitle@@',pr.PartyTitle2),
			'@@ItemDescription@@',isnull(ps.Description2,'')),
			null,
			ps.RowIndex
		FROM fin.ReceiveSubject  ps 
		join #ReceiveReceipt pr     on pr.ReceiveReceiptID = ps.ReceiveReceiptID
	    join fin.ReceiptType rt on rt.ReceiptTypeID = ps.ReceiptTypeID
	where ps.Allocation <> 0

		update a
		set ErrorMessage = isnull(ErrorMessage,'')  + @ProfitAndLossSlNotSet + char(10) + char(13)
		from #ReceiveReceipt a
		join #Allocation b on a.PrevoucherID = b.PrevoucherID
		where b.SlID is null

		if exists (select 1 from #ReceiveReceipt where ErrorMessage is not null )
		BEGIN	
			select ReceiveReceiptid,ErrorMessage from #ReceiveReceipt
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID ,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ReceiveReceipt
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from FIN.ReceiveReceipt a
		join #ReceiveReceipt b on a.ReceiveReceiptID = b.ReceiveReceiptID
    
		update #ReceiveSubjects
		set RoundedAmountInBaseCurrency = ROUND(AmountInBaseCurrency,@BaseDigit)


		;with 
		cte1 as
		(
		select ReceiveReceiptID,round(sum(AmountInBaseCurrency),@basedigit) - sum(RoundedAmountInBaseCurrency) Diff
		from #ReceiveSubjects
		group by ReceiveReceiptID
		having round(sum(AmountInBaseCurrency),@basedigit) <> sum(RoundedAmountInBaseCurrency)
		),
		cte2 as
		(
		select ReceiveReceiptID,ReceiveSubjectID,ROW_NUMBER() over(partition by ReceiveReceiptID order by rowindex)Rno 
		from #ReceiveSubjects 
		where CurrencyID <> -1
		)
		update c
		set RoundedAmountInBaseCurrency = RoundedAmountInBaseCurrency + Diff
		from cte1 a
		join cte2 b on a.ReceiveReceiptID = b.ReceiveReceiptID and b.Rno = 1
		join #ReceiveSubjects c on c.ReceiveSubjectID = b.ReceiveSubjectID 

		update #DocItems
		set RoundedAmountInBaseCurrency = ROUND(AmountInBaseCurrency,@BaseDigit)


		;with 
		cte1 as
		(
		select ReceiveReceiptID,round(sum(AmountInBaseCurrency),@basedigit) - sum(RoundedAmountInBaseCurrency) Diff
		from #DocItems
		group by ReceiveReceiptID
		having round(sum(AmountInBaseCurrency),@basedigit) <> sum(RoundedAmountInBaseCurrency)
		),
		cte2 as
		(
		select ReceiveReceiptID,BaseDocumentName,BaseDocumentID,ROW_NUMBER() over(partition by ReceiveReceiptID order by rowindex)Rno 
		from #DocItems 
		where CurrencyID <> -1
		)
		update c
		set RoundedAmountInBaseCurrency = RoundedAmountInBaseCurrency + Diff
		from cte1 a
		join cte2 b on a.ReceiveReceiptID = b.ReceiveReceiptID and b.Rno = 1
		join #DocItems c on c.BaseDocumentName = b.BaseDocumentName and c.BaseDocumentID = b.BaseDocumentID 

	    INSERT INTO ACC.PreVoucherItem 
			   (PreVoucherID ,
				RowIndex	   ,				
				SlID           ,
				DESCRIPTION , 
				Description2,
				Debit,			                
				Credit,
				CurrencyID ,
				CurrencyRate, 
				CurrencyDebit, 
				CurrencyCredit,
				Creator,  
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID)
	    SELECT	
			PreVoucherId,
			1,			
			di.SlID,
			Description ,
			Description2,
			di.RoundedAmountInBaseCurrency,
			0,     
			di.CurrencyId,
			di.CurrencyRate,
			di.Amount,
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			BaseDocumentName,
			BaseDocumentID
	    FROM #DocItems di
		order by RowIndex



		INSERT INTO ACC.PreVoucherItem 
				(
					PreVoucherID ,
					RowIndex	   ,
					SlID           ,
					DESCRIPTION , 
					Description2,
					Debit,			                
					Credit,
					CurrencyID ,
					CurrencyRate, 
					CurrencyDebit, 
					CurrencyCredit,
					Creator,  
					CreationDate,
					LastEditor,
					LastEditionDate,
					Version,
					BaseDocumentName,
					BaseDocumentID
					)
			SELECT	
				PreVoucherId,
				1,
				@DiscountSlID,
				DiscountDescription,
				DiscountDescription2, 
				di.DiscountInBaseCurrency,
				0,			
				-1,
				1,
				di.DiscountInBaseCurrency, 
				0,			           
				@CreatorId,
				GETDATE(),   
				@CreatorId,       
				GETDATE(),        
				0,
				'ReceiveSubject',
				ReceiveSubjectID
			FROM #ReceiveSubjects di 
			WHERE Discount > 0
			order by RowIndex




	    INSERT INTO ACC.PreVoucherItem 
			(
				PreVoucherID ,
				RowIndex	   ,
				SlID           ,
				DESCRIPTION , 
				Description2,
				Debit,			                
				Credit,
				CurrencyID ,
				CurrencyRate, 
				CurrencyDebit, 
				CurrencyCredit,
				Creator,  
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
	    SELECT	
			PreVoucherId,
			1,
			di.SlID,
			SubjectDescription  ,
			SubjectDescription2 , 
			case when di.Amount < 0 then abs(di.RoundedAmountInBaseCurrency) + abs(di.DiscountInBaseCurrency) else 0 end,
			case when di.Amount < 0 then 0 else abs(di.RoundedAmountInBaseCurrency)  + abs(di.DiscountInBaseCurrency) end,			
			di.CurrencyId,
			di.CurrencyRate,
			case when di.Amount < 0 then abs(di.Amount) + abs(di.Discount) else 0 end,
			case when di.Amount < 0 then 0 else abs(di.Amount)  + abs(di.Discount) end,	           
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'ReceiveSubject',
			ReceiveSubjectID
		FROM #ReceiveSubjects di	    
		order by RowIndex

		INSERT INTO ACC.PreVoucherItem 
				(
				PreVoucherID ,
				RowIndex	   ,
				SlID           ,
				DESCRIPTION , 
				Description2,
				Debit,			                
				Credit,
				CurrencyID ,
				CurrencyRate, 
				CurrencyDebit, 
				CurrencyCredit,
				Creator,  
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID)
			SELECT							
				PreVoucherId,
				1,
				SlID,
				Description,
				Description2,
				Debit,	
				Credit,		
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,	
				CurrencyCredit, 		           
				@CreatorId,
				GETDATE(),   
				@CreatorId,       
				GETDATE(),        
				0,
				'Allocation',
				DebitCreditNoteItemID
			FROM #Allocation 
			order by Debit desc

        INSERT INTO ACC.PreVoucherItemAccountLevel
        SELECT pvi.PreVoucherItemID,
               a.AccountLevelID,              
               dl.DlID,
               null,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               0
        from #Allocation temp
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'Allocation' and pvi.BaseDocumentID = temp.DebitCreditNoteItemID and temp.SlID = pvi.SlID
		join acc.AccountLevelSL a on a.SlID = temp.SlID
		join acc.DL dl on dl.DLID = temp.DlID and dl.DlTypeID = a.DlTypeID
		
	    INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    
	    SELECT	
			b.PreVoucherItemID,
			al.AccountLevelID,
			DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #ReceiveSubjects A
		JOIN ACC.PreVoucherItem B ON B.BaseDocumentName = 'ReceiveSubject' and b.BaseDocumentID = a.ReceiveSubjectID
	    JOIN acc.AccountLevelSL al ON b.SlID = al.SlID AND al.DlTypeID = a.DlTypeID 
	    
	    
	    ----Receive Subject sls that has bankAccountID dl
	        INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    
	    SELECT	
			b.PreVoucherItemID,
			al.AccountLevelID,
			BankAccountDlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #ReceiveSubjects A
		JOIN ACC.PreVoucherItem B ON B.BaseDocumentName = 'ReceiveSubject' and b.BaseDocumentID = a.ReceiveSubjectID
	    JOIN acc.AccountLevelSL al ON b.SlID = al.SlID AND al.DlTypeID = @BankAccountDlTypeID
	    WHERE a.BankAccountDlID is NOT NULL
	    
	    
	        
		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    
	    SELECT	
			pvi.PreVoucherItemID,
			al.AccountLevelID,
			a.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #DocItems a
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = a.BaseDocumentName and pvi.BaseDocumentID = a.BaseDocumentID
	    JOIN acc.AccountLevelSL al ON pvi.SlID = al.SlID 
		join acc.Dl on dl.DLID = a.DlID and dl.DlTypeID = al.DlTypeID

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    
	    SELECT	
			pvi.PreVoucherItemID,
			al.AccountLevelID,
			dl.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #DocItems a
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = a.BaseDocumentName and pvi.BaseDocumentID = a.BaseDocumentID
	    JOIN acc.AccountLevelSL al ON pvi.SlID = al.SlID 
		join acc.Dl on dl.DLID = a.CashDlIDForCheck and dl.DlTypeID = al.DlTypeID
	    
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(					
					REPLACE([pi].Description,
						'@@HeaderDescription@@',isnull(i.BaseDescription,'')),
						'@@PartyTitle@@',i.PartyTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@HeaderDescription@@',isnull(i.BaseDescription2,'')),
						'@@PartyTitle@@',i.PartyTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #ReceiveReceipt i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)
		
		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID    

		update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@HeaderDescription@@',isnull(i.BaseDescription,'')),
						'@@PartyTitle@@',i.PartyTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@HeaderDescription@@',isnull(i.BaseDescription2,'')),
						'@@PartyTitle@@',i.PartyTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #ReceiveReceipt i on pi.PrevoucherID = i.PrevoucherID
	
----------------End of #NoTask
