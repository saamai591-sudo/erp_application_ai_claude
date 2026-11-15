
------------------------------------- START #65188
CREATE   PROCEDURE [FIN].spPaymentReceiptPreVoucherInsert
	@PaymentReceiptId NVARCHAR(MAX)
--WITH ENCRYPTION 
AS 
              
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'PaymentReceipt'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'PaymentReceipt'),
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
				@OtherChequeDescription nvarchar(max),
				@OtherChequeDescription2 nvarchar(max)


		SET @CreatorId = CFG.GetuserID();
		set @BaseDigit = cfg.GetBaseCurrencyPrecision();	            

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@PaymentReceiptId) 		

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

		select  @OtherChequeDescription = Description,
				@OtherChequeDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'OtherCheque'

		SELECT @CurrencyExchangeDescription = Description,
			   @CurrencyExchangeDescription2 = Description2
		FROM CFG.[VoucherDescription] 
		WHERE MDEntityID = @MDEntity AND [Key] = 'CurrencyExchange'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by rr.PaymentReceiptID) PrevoucherID,	
				PaymentReceiptID,
				DlID   ,
				rr.BranchID,
				rr.FinancialPeriodID,
				rr.Status,
				rr.Number,
				rr.date,
				cast(null as varchar(max)) ErrorMessage ,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				@HeaderDescription  Description,
				@HeaderDescription2  Description2,
				rr.Description HeaderDescription,
				rr.Description2 HeaderDescription2,
				p.Title + ISNULL(' '+LastName,'') PartyTitle,
				p.Title2 + ISNULL(' '+LastName2,'') PartyTitle2
			into #PaymentReceipt	
	    FROM   FIN.PaymentReceipt rr 
		JOIN #DocumentIds b on rr.PaymentReceiptID = b.ID
	    INNER JOIN cfg.party p  ON  rr.PartyID = p.PartyID 
		JOIN cfg.DimDate DD on DD.Date = rr.Date
	    WHERE rr.PreVoucherID is null
	    
		update a
		set ErrorMessage = case when Status = 1 then N'Messages.FIN_spPaymentReceiptPreVoucherInsert_2'
								when Status = 2 then N'Messages.FIN_spPaymentReceiptPreVoucherInsert_8'
			end +char(10)+char(13)
		from #PaymentReceipt a
		where Status in (1,2)

		if exists (select * from #PaymentReceipt where ErrorMessage is not null )
		BEGIN	
			select PaymentReceiptID,ErrorMessage from #PaymentReceipt
			RETURN;
	    END
	  

		CREATE TABLE #PaymentSubjects
				(
				ID int identity (1,1),
				PaymentReceiptID int,
				PrevoucherID int,
				PaymentSubjectID INT,
				CurrencyID INT,
				CurrencyRate DECIMAL(36,10),
				Amount DECIMAL(36,10),
				AmountInBaseCurrency DECIMAL(36,10),
				RoundedAmountInBaseCurrency DECIMAL(36,10),
				SlID INT,
				DlID INT,
				Discount DECIMAL(36,10),
				DiscountInBaseCurrency DECIMAL(36,10),
				SubjectDescription nvarchar(max),
				SubjectDescription2 nvarchar(max),
				DiscountDescription nvarchar(max),
				DiscountDescription2 nvarchar(max),
				ContractDlID int	,
				PreVoucherItemID int,
				PettyCashID int,
				RowIndex int
				)
	    
		INSERT INTO #PaymentSubjects
				SELECT 
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				PaymentSubjectID ,
				rs.CurrencyID,
				rs.CurrencyRate,
				rs.Amount,
				case when c.IsBaseCurrencyBasis = 0
				then rs.Amount * rs.CurrencyRate / c.exchangeunit
					 when c.IsBaseCurrencyBasis = 1
				then rs.Amount * c.exchangeunit  / rs.CurrencyRate 
				end  ,
				0,
				case when PurchaseType.SlID is not null then PurchaseType.SlID
					 when SaleType.SlID is not null then SaleType.SlID
					 when SaleType2.SlID is not null then SaleType2.SlID
					 when PurchaseType2.SlID is not null then PurchaseType2.SlID
					 when CalculationResult.SlID is not null then CalculationResult.SlID
					 else PT.SLID end,
				rs.DLID,
				rs.Discount,
				case when c.IsBaseCurrencyBasis = 0
				then ROUND(Discount * rs.CurrencyRate / c.exchangeunit , @BaseDigit)
					 when c.IsBaseCurrencyBasis = 1
				then ROUND(Discount * c.exchangeunit  / rs.CurrencyRate , @BaseDigit)
				end DiscountInBaseCurrency	,
				REPLACE(@SubjectDescription,'@@ItemDescription@@',isnull(rs.[Description],'')),
				REPLACE(@SubjectDescription2,'@@ItemDescription@@',isnull(rs.[Description2],'')),
				@DiscountDescription,
				@DiscountDescription2,
				CASE WHEN Contract.DLID IS NOT NULL THEN Contract.DLID 
					 WHEN ContractSubject.DLID  IS NOT NULL THEN ContractSubject.DLID 
					 when ConfirmStatement.dlid IS NOT NULL THEN ConfirmStatement.DLID 
					 when ConfirmStatementItem.DLID IS NOT NULL THEN ConfirmStatementItem.DLID 
					 when ContractStatemen.DLID IS NOT NULL THEN ContractStatemen.DLID 
					 END,
				null	,
				rs.PettyCashID,
				rs.RowIndex
		FROM FIN.PaymentSubject rs 
		join #PaymentReceipt pr on pr.PaymentReceiptID = rs.PaymentReceiptID
		join fin.PaymentType PT on Pt.PaymentTypeID = rs.PaymentTypeID
		JOIN cfg.Currency AS c ON c.CurrencyID = rs.CurrencyID
		-- وقتی پرداخت از روی تایید فاکتور خرید (اصل فاکتور) ثبت شده باشد، rs.PurchaseInvoiceID خالی است
		-- و شناسه فاکتور باید از طریق ConfirmPurchaseInvoiceID پیدا شود
		left join vnd.ConfirmPurchaseInvoice cpi on cpi.ConfirmPurchaseInvoiceID = rs.ConfirmPurchaseInvoiceID
		left join vnd.PurchaseInvoice on PurchaseInvoice.PurchaseInvoiceID = COALESCE(rs.PurchaseInvoiceID, cpi.PurchaseInvoiceID)
		left join
		(
			select PurchaseInvoiceid,C.DLID
			from vnd.PurchaseInvoiceItem a
			join cnt.ContractSubject b
				on a.ContractSubjectID = b.ContractSubjectID
			JOIN cnt.Contract C
				ON C.ContractID = B.ContractID
			GROUP BY PurchaseInvoiceid,C.DLID

		) ContractSubject ON ContractSubject.PurchaseInvoiceID = PurchaseInvoice.PurchaseInvoiceID
		left join [CNT].[vwConfirmStatementRemain] ConfirmStatement on ConfirmStatement.ConfirmStatementID = rs.ConfirmStatementID
		left join [CNT].[vwConfirmStatementItemRemain] ConfirmStatementItem
			on ConfirmStatementItem.ConfirmStatementItemID = rs.ConfirmStatementItemID
		left join [CNT].[vwContractStatementRemain] ContractStatemen on ContractStatemen.ContractStatementID = rs.ContractStatementID
		left join vnd.PurchaseType on PurchaseType.PurchaseTypeID = PurchaseInvoice.Type
		left join sle.ReturnedSaleInvoice on ReturnedSaleInvoice.ReturnedSaleInvoiceID = rs.ReturnedSaleInvoiceID
		left join sle.SaleType on SaleType.SaleTypeID = ReturnedSaleInvoice.SaleTypeID
		left join sle.Invoice on Invoice.InvoiceID = rs.InvoiceID
		left join cnt.Contract on Contract.ContractID = rs.ContractID
		left join sle.SaleType SaleType2 on SaleType2.SaleTypeID = Invoice.SaleTypeID
		left join cfg.InstallmentPaymentItem on InstallmentPaymentItem.InstallmentPaymentItemID = rs.InstallmentPaymentItemID
		left join cfg.InstallmentPayment on InstallmentPayment.InstallmentPaymentID = InstallmentPaymentItem.InstallmentPaymentID
										 and InstallmentPayment.BaseType = 4
		left join vnd.PurchaseInvoice PurchaseInvoice2 on PurchaseInvoice2.PurchaseInvoiceID = InstallmentPayment.DocumentID
		left join vnd.PurchaseType PurchaseType2 on PurchaseType2.PurchaseTypeID = PurchaseInvoice2.Type
		left join
		(
			select cr.CalculationResultID,SlID,p.ParameterID 
			from pay.CalculationResult cr
			join pay.CalculationPersonel AS cp on cp.CalculationPersonelID=cr.CalculationPersonelID
			join pay.Parameter p on p.ParameterID = cr.ParameterID
			join  HRM.CalendarMonth cm on cm.CalendarMonthID = cp.CalendarMonthID
			cross APPLY
			(
				select c.slid
				from
				(
				select top 1 PersonelID,PayrollAccGroupID
				from pay.PersonelVoucherSetting a
				join  HRM.CalendarMonth b 	on a.CalendarMonthID = b.CalendarMonthID

				where EndDate <= cm.EndDate 
				and a.PersonelID = cp.PersonelID
				order by b.EndDate desc
				)a
				join 
				(
					select a.PayrollAccGroupID,ParameterID,SlID,EndDate,ROW_NUMBER() over(partition by PayrollAccGroupID,ParameterID order by EndDate desc) Rno
					from pay.PayrollAccConfiguration a
					join  HRM.CalendarMonth b 	on a.CalendarMonthID = b.CalendarMonthID 
					where EndDate <= cm.EndDate 
				)c on c.PayrollAccGroupID = a.PayrollAccGroupID and c.ParameterID = p.ParameterID and rno = 1
			)V
			where p.SystemName = 'khales' 
		)CalculationResult on CalculationResult.CalculationResultID = rs.CalculationResultID
		WHERE rs.PayPreparingID  is null
		order by RowIndex asc

		INSERT INTO #PaymentSubjects
				SELECT 
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				PaymentSubjectID,
				rs.CurrencyID,
				rs.CurrencyRate,
				rs.Amount,
				case when c.IsBaseCurrencyBasis = 0
				then rs.Amount * rs.CurrencyRate / c.exchangeunit
					 when c.IsBaseCurrencyBasis = 1
				then rs.Amount * c.exchangeunit  / rs.CurrencyRate 
				end  ,
				0,
				PT.SLID,
				rs.DLID,
				0,
				0,
				REPLACE(@SubjectDescription,'@@ItemDescription@@',isnull(rs.[Description],'')),
				REPLACE(@SubjectDescription2,'@@ItemDescription@@',isnull(rs.[Description2],'')),
				@DiscountDescription,
				@DiscountDescription2,
				null,
				null,
				rs.PettyCashID,
				rs.RowIndex
		FROM FIN.PaymentSubject rs 
		join #PaymentReceipt pr on pr.PaymentReceiptID = rs.PaymentReceiptID
		join fin.PaymentType PT on Pt.PaymentTypeID = rs.PaymentTypeID
		JOIN cfg.Currency AS c ON c.CurrencyID = rs.CurrencyID
		join pay.PayPreparing pp on pp.PayPreparingID = rs.PayPreparingID
		join pay.PayrollPaymentType ppt on ppt.PayrollPaymentTypeID = pp.PayrollPaymentTypeID 
		left join acc.vwAccountLevelSL als on als.SlID = pt.SLID and als.DlTypeCode = 103
		WHERE 
		((ppt.type = 0 and DlTypeCode  is  null)
		or
		ppt.type = 1
		)
		order by RowIndex asc

	 
		INSERT INTO #PaymentSubjects
		SELECT 
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				PaymentSubjectID,
				rs.CurrencyID,
				rs.CurrencyRate,
				ppi.Value,
				case when c.IsBaseCurrencyBasis = 0
				then ppi.Value * rs.CurrencyRate / c.exchangeunit 
					 when c.IsBaseCurrencyBasis = 1
				then ppi.Value * c.exchangeunit  / rs.CurrencyRate 
				end  ,
				0,
				PT.SLID,
				pa.DlID,
				0,
				0,
				REPLACE(@SubjectDescription,'@@ItemDescription@@',isnull(rs.[Description],'')),
				REPLACE(@SubjectDescription2,'@@ItemDescription@@',isnull(rs.[Description2],'')),
				@DiscountDescription,
				@DiscountDescription2,
				null,
				null,
				rs.PettyCashID,
				rs.RowIndex
		FROM FIN.PaymentSubject rs 
		join #PaymentReceipt pr on pr.PaymentReceiptID = rs.PaymentReceiptID
		join fin.PaymentType PT on Pt.PaymentTypeID = rs.PaymentTypeID
		JOIN cfg.Currency AS c ON c.CurrencyID = rs.CurrencyID
		join pay.PayPreparing pp on pp.PayPreparingID = rs.PayPreparingID
		join pay.PayrollPaymentType ppt on ppt.PayrollPaymentTypeID = pp.PayrollPaymentTypeID and ppt.Type = 0
		join acc.vwAccountLevelSL als on als.SlID = pt.SLID and als.DlTypeCode = 103
		join 
		(select PayPreparingID,PersonnelID,sum(Value) Value
		from pay.PayPreparingItem
		group by PayPreparingID,PersonnelID
		)ppi on pp.PayPreparingID = ppi.PayPreparingID
		join hrm.Personel p on p.PersonelID = ppi.PersonnelID
		join cfg.Party pa on pa.PartyID = p.PartyID
		order by RowIndex asc

		INSERT INTO #PaymentSubjects
		SELECT 
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				null,
				rs.CurrencyID,
				rs.CurrencyRate,
				rs.Wage,
				case when c.IsBaseCurrencyBasis = 0
				then rs.Wage * rs.CurrencyRate / c.exchangeunit 
					 when c.IsBaseCurrencyBasis = 1
				then rs.Wage * c.exchangeunit  / rs.CurrencyRate 
				end  ,
				0,
				ba.WageSLID,
				ba.DlID,
				0,
				0,
				REPLACE(@SubjectDescription,'@@ItemDescription@@',isnull(rs.[Description],'')),
				REPLACE(@SubjectDescription2,'@@ItemDescription@@',isnull(rs.[Description2],'')),
				@DiscountDescription,
				@DiscountDescription2,
				null,
				null,
				null,
				rs.RowIndex
		FROM FIN.PaymentBankDraft rs 
		join #PaymentReceipt pr on pr.PaymentReceiptID = rs.PaymentReceiptID
		join cfg.BankAccount ba on ba.BankAccountID = rs.BankAccountID
		JOIN cfg.Currency AS c ON c.CurrencyID = rs.CurrencyID
		where Wage > 0
		order by RowIndex asc



		CREATE TABLE #Allocation
				(
				PaymentReceiptID int,
				PrevoucherID int,
				PaymentSubjectID INT,
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
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				ps.PaymentSubjectID,
				ps.CurrencyID,
				0,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				0,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				0,
				PT.SLID,
				ps.DlID,
				REPLACE(@CurrencyExchangeDescription,
				'@@ItemDescription@@',isnull(ps.Description,'')),
				REPLACE(@CurrencyExchangeDescription2,
				'@@ItemDescription@@',isnull(ps.Description2,'')),
				null,
				ps.RowIndex
		FROM FIN.PaymentSubject ps 
		join #PaymentReceipt pr on pr.PaymentReceiptID = ps.PaymentReceiptID
		join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		where ps.Allocation <> 0
		order by RowIndex asc

		INSERT INTO #Allocation
		SELECT 
				pr.PaymentReceiptID,
				pr.PrevoucherID,
				ps.PaymentSubjectID,
				-1,
				1,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				PT.AllocationSlID,
				ps.DlID,
				REPLACE(@CurrencyExchangeDescription,
				'@@ItemDescription@@',isnull(ps.Description,'')),
				REPLACE(@CurrencyExchangeDescription2,
				'@@ItemDescription@@',isnull(ps.Description2,'')),
				null,
				ps.RowIndex
		FROM FIN.PaymentSubject ps 
		join #PaymentReceipt pr on pr.PaymentReceiptID = ps.PaymentReceiptID
		join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		where ps.Allocation <> 0
		order by RowIndex asc

		update a
		set ErrorMessage = N'FIN_spPaymentReceiptPreVoucherInsert_3^'+cast(Number as varchar(10))+char(10)+char(13)
		from #PaymentReceipt a
		where PaymentReceiptID not in
		(
		select PaymentReceiptID
		from #PaymentSubjects
		group by PaymentReceiptID
		)

		if exists (select * from #PaymentReceipt where ErrorMessage is not null )
		BEGIN	
			select PaymentReceiptID,ErrorMessage from #PaymentReceipt
			RETURN;
		END
	
		CREATE TABLE #DocItems
		(
		BaseDocumentName varchar(256),
		BaseDocumentID int,
		PaymentReceiptID int,
		PreVoucherID int,
		CurrencyID INT,
		CurrencyRate DECIMAL(36,10),
		Amount DECIMAL(36,10),
		AmountInBaseCurrency DECIMAL(36,10),
		RoundedAmountInBaseCurrency DECIMAL(36,10),
		SlID INT,
		DlID INT,
		DESCRIPTION NVARCHAR(max),
		DESCRIPTION2 NVARCHAR(max),
		RowIndex int
		)
	
		INSERT INTO #DocItems
		SELECT  'PaymentBankDraft',
				PaymentBankDraftID,
				pr.PaymentReceiptID,
				PreVoucherID,
				RBD.CurrencyID,
				RBD.CurrencyRate,			
				Amount+Wage,
				case when c.IsBaseCurrencyBasis = 0
				then (Amount+Wage) * RBD.CurrencyRate / c.exchangeunit
					 when c.IsBaseCurrencyBasis = 1
				then (Amount+Wage) * c.exchangeunit  / RBD.CurrencyRate
					end ,
				0,
				ba.SLID,
				ba.DlID,
				REPLACE(
				REPLACE(@BankDraftDescription
				,'@@TraceNumber@@',RBD.Number)
				,'@@ItemDescription@@',isnull(rbd.[Description],'')),
				REPLACE(
				REPLACE(@BankDraftDescription2
				,'@@TraceNumber@@',RBD.Number)
				,'@@ItemDescription@@',isnull(rbd.[Description2],'')),
				rbd.RowIndex
		from FIN.PaymentBankDraft RBD
		join #PaymentReceipt pr on pr.PaymentReceiptID = RBD.PaymentReceiptID
		JOIN cfg.BankAccount ba ON ba.BankAccountID = RBD.BankAccountID
		JOIN cfg.Currency AS c ON c.CurrencyID = RBD.CurrencyID	
		order by RowIndex asc

		INSERT INTO #DocItems 
		SELECT  'PaymentCash',
				PaymentCashID,
				pr.PaymentReceiptID,
				PreVoucherID,
				RC.CurrencyID,
				RC.CurrencyRate,
				Amount,
				case when c2.IsBaseCurrencyBasis = 0
				then Amount * RC.CurrencyRate / c2.exchangeunit
					 when c2.IsBaseCurrencyBasis = 1
				then Amount * c2.exchangeunit  / RC.CurrencyRate
				end ,
				0,
				cb.SlID,
				c.DlID,
				REPLACE(@CashDescription,'@@ItemDescription@@',isnull(rc.[Description],'')),
				REPLACE(@CashDescription2,'@@ItemDescription@@',isnull(rc.[Description2],''))	,
				rc.RowIndex
		from FIN.PaymentCash RC
		join #PaymentReceipt pr on pr.PaymentReceiptID = RC.PaymentReceiptID
		JOIN cfg.Currency AS c2 ON c2.CurrencyID = RC.CurrencyID
		JOIN cfg.Cash c ON c.CashID = RC.CashID
		left join cfg.CashBalance cb on c.CashID = cb.CashID and cb.CurrencyID = rc.CurrencyID
		order by RowIndex asc

		INSERT INTO #DocItems 
		SELECT  'PaymentCheqe',
				PaymentCheqeID,
				pr.PaymentReceiptID,
				PreVoucherID,
				pc.CurrencyID,
				pc.CurrencyRate,
				Amount,
				case when c.IsBaseCurrencyBasis = 0
				then Amount * pc.CurrencyRate / c.exchangeunit 
					 when c.IsBaseCurrencyBasis = 1
				then Amount * c.exchangeunit  / pc.CurrencyRate
				end ,
				0,
				case when ba.Today = 1 then a.SLID else ba.SlID end,
				a.DlID,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@ChequeDescription
				,'@@GregorianDueDate@@',dd.FullDateAlternateKey)
				,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
				,'@@ChequeNumber@@',pc.Number)
				,'@@ItemDescription@@',isnull(pc.[Description],'')),
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@ChequeDescription2
				,'@@GregorianDueDate@@',dd.FullDateAlternateKey)
				,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
				,'@@ChequeNumber@@',pc.Number)
				,'@@ItemDescription@@',isnull(pc.[Description2],'')),
				pc.RowIndex
		from FIN.PaymentCheqe pc
		join #PaymentReceipt pr on pr.PaymentReceiptID = pc.PaymentReceiptID
		JOIN fin.PaymentCheqeType ba ON ba.PaymentCheqeTypeID = pc.PaymentCheqeTypeID
		join cfg.bankaccount a on a.BankAccountID = pc.BankAccountID
		JOIN cfg.Currency AS c ON c.CurrencyID = pC.CurrencyID	
		join cfg.DimDate dd on dd.Date = pc.Date
		order by RowIndex asc

		INSERT INTO #DocItems 
		SELECT  'PaymentOtherCheqe',
				PaymentOtherCheqeID,
				pr.PaymentReceiptID,
				pr.PreVoucherID,
				rc2.CurrencyID,
				CurrencyRate,
				Amount,
				case when c.IsBaseCurrencyBasis = 0
				then Amount * RC2.CurrencyRate / c.exchangeunit
					 when c.IsBaseCurrencyBasis = 1
				then Amount * c.exchangeunit  / RC2.CurrencyRate
				end ,
				0,
				CASE WHEN rc2.CurrencyID = -1 AND rcfi2.State = 7
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'ByProtestedDocumentSl') 
					 WHEN rc2.CurrencyID <> -1 AND rcfi2.State = 7
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'CurrencyByProtestedDocumentSl') 
					WHEN rc2.CurrencyID = -1 AND Commercial = 1
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'ReceivedDocumentSl')
					 WHEN rc2.CurrencyID = -1 AND Commercial = 0
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'OtherReceivedDocumentSl')
					 WHEN rc2.CurrencyID <> -1 AND Commercial = 1
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'CurrencyReceivedDocumentSl')
					 WHEN rc2.CurrencyID <> -1 AND Commercial = 0
					THEN (SELECT TOP 1 ConfigValue FROM CFG.Configuration f WHERE f.ConfigKey = 'CurrecnyOtherReceivedDocumentSl')
				END AS SlID,
				p.DlID,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@OtherChequeDescription,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
						,'@@GregorianDueDate@@',dd.FullDateAlternateKey)
						,'@@ChequeNumber@@',isnull(rc2.Number,''))					
						,'@@ItemDescription@@',isnull(rc.[Description],'')),
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(@OtherChequeDescription2,'@@SolarDueDate@@',dd.PersianFullDateAlternateKey)
						,'@@GregorianDueDate@@',dd.FullDateAlternateKey)
						,'@@ChequeNumber@@',isnull(rc2.Number,''))					
						,'@@ItemDescription@@',isnull(rc.[Description2],'')),
				rc.RowIndex
		from FIN.PaymentOtherCheqe RC
		join #PaymentReceipt pr on pr.PaymentReceiptID = RC.PaymentReceiptID
		JOIN FIN.ReceivedCheqe RC2 ON rc.ReceivedCheqeID = RC2.ReceivedCheqeID
		JOIN fin.ReceiveReceipt rr ON rr.ReceiveReceiptID = RC2.ReceiveReceiptID
		JOIN cfg.Party p ON p.PartyID = rr.PartyID
		JOIN cfg.Currency AS c ON c.CurrencyID = rC2.CurrencyID		
		left join fin.ReceiptCheqeFlowItem rcfi on rc.ReceiptCheqeFlowItemID = rcfi.ReceiptCheqeFlowItemID 
		left join fin.ReceiptCheqeFlowItem rcfi2 on rcfi2.ReceiptCheqeFlowItemID = rcfi.PreviousFlow
		join cfg.DimDate dd on dd.Date = rc2.Date
		order by RowIndex asc

		declare @DiscountSlID int
	  	SELECT @DiscountSlID = ConfigValue 
	  	                    FROM CFG.Configuration 
	  	                    WHERE ConfigKey = 'PurchaseDiscountSliD'
	  
	    IF @DiscountSlID IS NULL
	    BEGIN			
		update a
		set ErrorMessage = N'FIN_spPaymentReceiptPreVoucherInsert_7^'+cast(Number as varchar(10))+char(10)+char(13)
		from #PaymentReceipt a	
		join #PaymentSubjects b on a.PaymentReceiptID = b.PaymentReceiptID
		where Discount > 0
	    END

		update a
		set ErrorMessage = isnull(ErrorMessage ,'')+N'FinanceManager.Messages.InBankForWageSlNotSpeceified^' + dl.Title +char(10)+char(13)
		from #PaymentReceipt a	
		join #PaymentSubjects b on a.PaymentReceiptID = b.PaymentReceiptID
		join acc.dl on dl.DLID = b.DlID
		where b.slid is null and PaymentSubjectID is null

		update a
		set ErrorMessage = isnull(ErrorMessage ,'') +  N'FinanceManager.Messages.SlInSubjects'+char(10)+char(13)
		from #PaymentReceipt a	
		join #PaymentSubjects b on a.PaymentReceiptID = b.PaymentReceiptID
		where b.slid is null and PaymentSubjectID is not null

		update a
		set ErrorMessage = isnull(ErrorMessage ,'')+ N'FIN_spPaymentReceiptPreVoucherInsert_5^'+cast(Number as varchar(10))+char(10)+char(13)
		from #PaymentReceipt a
		join 
		(SELECT PaymentReceiptID, SUM(round(AmountInBaseCurrency,@basedigit))  AmountInBaseCurrency
		FROM   #PaymentSubjects 
		group by PaymentReceiptID) b on a.PaymentReceiptID = b.PaymentReceiptID
		join 
		(SELECT PaymentReceiptID,SUM(round(AmountInBaseCurrency,@basedigit)) AmountInBaseCurrency
		FROM   #DocItems
		group by PaymentReceiptID) c on c.PaymentReceiptID = a.PaymentReceiptID
		where b.AmountInBaseCurrency <> c.AmountInBaseCurrency
		
		update a
		set ErrorMessage = isnull(ErrorMessage ,'')+ N'FinanceManager.Messages.SlNotSpecefiedForSelectedPaymentChqueType'+char(10)+char(13)
		from #PaymentReceipt a	
		join #DocItems b on a.PaymentReceiptID = b.PaymentReceiptID
		where BaseDocumentName = 'PaymentCheqe' and SlID is null 

		update a
		set ErrorMessage = isnull(ErrorMessage ,'')+ N'FinanceManager.Messages.InCashForCurrencySlNotSpeceified^'+ dl.Title+','+Currency.Title+char(10)+char(13)
		from #PaymentReceipt a	
		join #DocItems b on a.PaymentReceiptID = b.PaymentReceiptID
		join acc.dl on dl.DLID = b.DlID
		join cfg.Currency on Currency.CurrencyID = b.CurrencyID
		where BaseDocumentName = 'PaymentCash' and SlID is null 

		if exists (select * from #PaymentReceipt where ErrorMessage is not null )
		BEGIN	
			select PaymentReceiptID,ErrorMessage from #PaymentReceipt
			RETURN;
	    END
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #PaymentReceipt
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from FIN.PaymentReceipt a
		join #PaymentReceipt b on a.PaymentReceiptID = b.PaymentReceiptID

		declare @MaxItemId int

		select @MaxItemId = max(PreVoucherItemID)
		from acc.PreVoucherItem

		update #PaymentSubjects
		set PreVoucherItemID = ISNULL(@MaxItemId,1) + id,
		RoundedAmountInBaseCurrency = ROUND(AmountInBaseCurrency,@BaseDigit)


		;with 
		cte1 as
		(
		select PaymentReceiptID,round(sum(AmountInBaseCurrency),@basedigit) - sum(RoundedAmountInBaseCurrency) Diff
		from #PaymentSubjects
		group by PaymentReceiptID
		having round(sum(AmountInBaseCurrency),@basedigit) <> sum(RoundedAmountInBaseCurrency)
		),
		cte2 as
		(
		select PaymentReceiptID,PaymentSubjectID,ROW_NUMBER() over(partition by PaymentReceiptID order by rowindex)Rno 
		from #PaymentSubjects 
		where CurrencyID <> -1
		)
		update c
		set RoundedAmountInBaseCurrency = RoundedAmountInBaseCurrency + Diff
		from cte1 a
		join cte2 b on a.PaymentReceiptID = b.PaymentReceiptID and b.Rno = 1
		join #PaymentSubjects c on c.PaymentSubjectID = b.PaymentSubjectID 

		update #DocItems
		set RoundedAmountInBaseCurrency = ROUND(AmountInBaseCurrency,@BaseDigit)


		;with 
		cte1 as
		(
		select PaymentReceiptID,round(sum(AmountInBaseCurrency),@basedigit) - sum(RoundedAmountInBaseCurrency) Diff
		from #DocItems
		group by PaymentReceiptID
		having round(sum(AmountInBaseCurrency),@basedigit) <> sum(RoundedAmountInBaseCurrency)
		),
		cte2 as
		(
		select PaymentReceiptID,BaseDocumentName,BaseDocumentID,ROW_NUMBER() over(partition by PaymentReceiptID order by rowindex)Rno 
		from #DocItems 
		where CurrencyID <> -1
		)
		update c
		set RoundedAmountInBaseCurrency = RoundedAmountInBaseCurrency + Diff
		from cte1 a
		join cte2 b on a.PaymentReceiptID = b.PaymentReceiptID and b.Rno = 1
		join #DocItems c on c.BaseDocumentName = b.BaseDocumentName and c.BaseDocumentID = b.BaseDocumentID 

		set identity_insert ACC.PreVoucherItem on
		INSERT INTO ACC.PreVoucherItem 
			(	
				PreVoucherItemID,
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
			PreVoucherItemID,
			PreVoucherId,
			1,
			di.SlID,
			SubjectDescription,
			SubjectDescription2,
			case when di.Amount > 0 then di.RoundedAmountInBaseCurrency+di.DiscountInBaseCurrency else 0 end ,	
			case when di.Amount > 0 then 0 else abs(di.RoundedAmountInBaseCurrency + di.DiscountInBaseCurrency) end,		
			CASE WHEN s.HasCurrency = 1 then di.CurrencyId else -1 end,
			CASE WHEN s.HasCurrency = 1 then di.CurrencyRate else 1 end,
			case when di.Amount > 0 then CASE WHEN s.HasCurrency=1 then  di.Amount + di.Discount else di.AmountInBaseCurrency + di.DiscountInBaseCurrency end else 0 end ,	
			case when di.Amount > 0 then 0 else CASE WHEN s.HasCurrency = 1  then abs(di.Amount + di.Discount) else ABS(di.AmountInBaseCurrency + di.DiscountInBaseCurrency) END END,	         
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'PaymentSubject',
			PaymentSubjectID
		FROM #PaymentSubjects di	
		join acc.SL AS s on di.SlID = s.SlID    
		order by di.RowIndex asc
		set identity_insert ACC.PreVoucherItem off
	
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
			Description2 , 
			0,
			di.RoundedAmountInBaseCurrency,   
			CASE WHEN s.HasCurrency  =1 then di.CurrencyId else -1 end,
			CASE WHEN s.HasCurrency = 1 then di.CurrencyRate else 1 end,
			0,
			CASE WHEN s.HasCurrency = 1 then  di.Amount else di.RoundedAmountInBaseCurrency end,          
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			BaseDocumentName,
			BaseDocumentID
	    FROM #DocItems di
	    join acc.SL AS s on di.SlID = s.SlID
		order by BaseDocumentName,di.RowIndex
		
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
				BaseDocumentID			)
			SELECT							
				PreVoucherId,
				1,
				@DiscountSlID,
				DiscountDescription,
				DiscountDescription2,
				0,	
				di.DiscountInBaseCurrency,		
				-1,
				1,
				0,	
				di.DiscountInBaseCurrency, 		           
				@CreatorId,
				GETDATE(),   
				@CreatorId,       
				GETDATE(),        
				0,
				'PaymentSubjectDiscount',
				PaymentSubjectID
			FROM #PaymentSubjects di 
			WHERE Discount > 0
			order by di.RowIndex
		
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
				PaymentSubjectID
			FROM #Allocation 
			order by Debit desc
	    
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
			d.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
		FROM #PaymentSubjects a
		join fin.PettyCash pc on pc.PettyCashID = a.PettyCashID
		JOIN ACC.PreVoucherItem B ON a.PreVoucherItemID = b.PreVoucherItemID 
		JOIN acc.AccountLevelSL al ON b.SlID = al.SlID 
		join cfg.Party p on p.PartyID = pc.PartyID
		JOIN acc.DL d ON d.DlID = p.DlID  AND al.DlTypeID = d.DlTypeID


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
			a.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
		FROM #PaymentSubjects a
		JOIN ACC.PreVoucherItem B ON a.PreVoucherItemID = b.PreVoucherItemID 
		JOIN acc.AccountLevelSL al ON b.SlID = al.SlID 
		JOIN acc.DL d ON d.DlID = a.DlID  AND al.DlTypeID = d.DlTypeID
		left join acc.PreVoucherItemAccountLevel pial on pial.PreVoucherItemID = b.PreVoucherItemID and al.AccountLevelID = pial.AccountLevelID
		where pial.PreVoucherItemAccountLevelID is null
			
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
			ContractDlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
		FROM #PaymentSubjects a
		JOIN ACC.PreVoucherItem B ON a.PreVoucherItemID = b.PreVoucherItemID 
		JOIN acc.AccountLevelSL al ON b.SlID = al.SlID 
		JOIN acc.Dl on dl.DLID = a.ContractDlID and dl.DlTypeID = al.DlTypeID

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
			a.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #PaymentReceipt a
		join acc.PreVoucherItem pvi on pvi.PreVoucherID = a.PrevoucherID
	    JOIN acc.AccountLevelSL al ON pvi.SlID = al.SlID 
		join acc.Dl on dl.DLID = a.DlID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pial on pial.PreVoucherItemID = pvi.PreVoucherItemID and al.AccountLevelID = pial.AccountLevelID
		where pial.PreVoucherItemAccountLevelID is null




		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@PartyTitle@@',isnull(i.PartyTitle,'')),
						'@@HeaderDescription@@',isnull(i.HeaderDescription,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PartyTitle@@',i.PartyTitle) [Description],
					REPLACE (REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(isnull([pi].Description2,[pi].Description),
						'@@PartyTitle@@',isnull(i.PartyTitle2,'')),
						'@@HeaderDescription@@',isnull(i.HeaderDescription2,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PartyTitle@@',i.PartyTitle2) [Description2]
			from #PaymentReceipt i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = isnull(vi.Description2,vi.Description)
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID    


		update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@PartyTitle@@',isnull(i.PartyTitle,'')),
						'@@HeaderDescription@@',isnull(i.HeaderDescription,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(isnull([pi].Description2,[pi].Description),
						'@@PartyTitle@@',isnull(i.PartyTitle2,'')),
						'@@HeaderDescription@@',isnull(i.HeaderDescription2,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #PaymentReceipt i on pi.PrevoucherID = i.PrevoucherID
