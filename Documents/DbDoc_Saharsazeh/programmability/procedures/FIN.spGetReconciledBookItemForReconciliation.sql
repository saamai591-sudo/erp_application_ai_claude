
CREATE   PROCEDURE [FIN].spGetReconciledBookItemForReconciliation
    @SelectedBankAccount INT ,
    @ToDate DATE 
--WITH ENCRYPTION	
AS
    BEGIN
	
        CREATE TABLE #ReconciledBookTemp
            (
              ReconciliationID INT ,
              EntityName nvarchar(1050) ,
              EntityType TINYINT ,
              EntityID INT ,
			  MasterID int,
			  EngName nvarchar(50),
              Number NVARCHAR(100) ,
              [Date] DATE ,
              PersianDate NVARCHAR(20) ,
              Deposite DECIMAL(30, 4) ,
              Withdraw DECIMAL(30, 4),
			  PartyID bigint ,
			  PartyName nvarchar(1050) ,
			  VoucherID INT ,
			  VoucherNumber NVARCHAR(200) 
            )

        BEGIN

            DECLARE @CashToBank NVARCHAR(100) ,
                @CashFromBank NVARCHAR(100) ,
                @Payment NVARCHAR(100) ,
                @BankDraft NVARCHAR(100) ,
                @TodayCheqe NVARCHAR(100) ,
                @Outgoing NVARCHAR(100) ,
                @TransferToBank NVARCHAR(100) ,
                @PaymentCheqeCashing NVARCHAR(100) ,
                @FromDate DATE ,
                @FinancialStartDate DATE ,
                @BookDate DATE ,
                @BookId INT ,
                @DrawBackedCheque NVARCHAR(100)

            SELECT  @FinancialStartDate = StartDate
            FROM    CFG.FinancialPeriod
            WHERE   StartDate <= @ToDate
                    AND EndDate >= @ToDate

            SELECT  @BookDate = [Date] ,
                    @BookId = BookID
            FROM    FIN.Book
            WHERE   BankAccountID = @SelectedBankAccount

            IF @BookDate > @FinancialStartDate
                BEGIN
                    SET @FromDate = @BookDate
                END
            ELSE
                BEGIN
                    SET @FromDate = @FinancialStartDate
                END
    

		
            SELECT  @CashToBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInReceive'
                    AND le.Item = 'CashToBank'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @CashFromBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInReceive'
                    AND le.Item = 'CashFromBank'
                    AND lev.Culture = CFG.GetuserCulture()
	
            SELECT  @BankDraft = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'PaymentMethod'
                    AND le.Item = 'BankDraft'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @TodayCheqe = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInPayment'
                    AND le.Item = 'TodayCheqe'
                    AND lev.Culture = CFG.GetuserCulture()
            
			SELECT  @Outgoing = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'SaleAndPurchaseBill'
                    AND le.Item = 'ReceivedBankDraft'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @TransferToBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'Others'
                    AND le.Item = 'TransferToBank'
                    AND lev.Culture = CFG.GetuserCulture()
		
            SELECT  @PaymentCheqeCashing = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'Others'
                    AND le.Item = 'PaymentCheqeCashing'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @DrawBackedCheque = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'PaymentCheqeCommitmentState'
                    AND le.Item = 'DrawBacked'
                    AND lev.Culture = CFG.GetuserCulture()
	
        END


		select * 
		into #VWVoucherPrevoucher
		from acc.VWVoucherPrevoucher


							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @Outgoing EntityName ,
                                    1 EntityType ,
                                    rbd.ReceivedBankDraftID EntityID ,
									rbd.ReceiveReceiptID MasterID,
									'ReceiveReceipt' EngName,
                                    rbd.Number Number ,
                                    rbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(rbd.[Date], 0) PersianDate ,
                                    rbd.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceivedBankDraft rbd
                                    INNER JOIN FIN.ReceiveReceipt rr ON rbd.ReceiveReceiptID = rr.ReceiveReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rbd.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rr.PreVoucherID
                          WHERE     rbd.[Date] <= @ToDate
                                    AND rbd.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rbd.ReceivedBankDraftID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 1 
																	)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
									@Outgoing EntityName ,
                                    1 EntityType ,
                                    rbd.ReceivedBankDraftID EntityID ,
									rbd.ReceiveReceiptID MasterID,
									'ReceiveReceipt' EngName,
                                    rbd.Number Number ,
                                    rbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(rbd.[Date], 0) PersianDate ,
                                    rbd.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceivedBankDraft rbd
                                    INNER JOIN FIN.ReceiveReceipt rr ON rbd.ReceiveReceiptID = rr.ReceiveReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rbd.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rr.PreVoucherID
                          WHERE     rbd.[Date] <= @ToDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rbd.ReceivedBankDraftID IN 
																(
																SELECT DISTINCT
																		rbi.EntityID
																FROM    FIN.ReconciledBookItem rbi
																WHERE   rbi.EntityType = 1
																		AND rbi.EntityID NOT IN 
																		(
																		SELECT DISTINCT
																				rbi2.EntityID
																		FROM    FIN.ReconciledBookItem rbi2
																		WHERE   rbi2.Passed = 1
																				AND rbi2.EntityType = 1 
																		) 
																)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @CashToBank EntityName ,
                                    2 EntityType ,
                                    rcfi.ReceiptCheqeFlowItemID EntityID ,
									rcfi.ReceiptCheqeFlowID MasterID,
									'ReceiptCheqeFlow' EngName,
                                    rc.Number Number ,
                                    rcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(rcf.[Date], 0) PersianDate ,
                                    rc.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceiptCheqeFlowItem rcfi
                                    INNER JOIN FIN.ReceiptCheqeFlow rcf ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
                                    INNER JOIN FIN.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
                                    INNER JOIN FIN.ReceiveReceipt rr ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rcf.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rcf.PreVoucherID
                          WHERE     rcfi.[State] = 4
                                    AND rcf.[Date] <= @ToDate
                                    AND rcf.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rcfi.ReceiptCheqeFlowItemID NOT IN 
																	(
																	SELECT  rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 2 
																	)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @CashToBank EntityName ,
                                    2 EntityType ,
                                    rcfi.ReceiptCheqeFlowItemID EntityID ,
									rcfi.ReceiptCheqeFlowID MasterID,
									'ReceiptCheqeFlow' EngName,
                                    rc.Number Number ,
                                    rcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(rcf.[Date], 0) PersianDate ,
                                    rc.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceiptCheqeFlowItem rcfi
                                    INNER JOIN FIN.ReceiptCheqeFlow rcf ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
                                    INNER JOIN FIN.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
                                    INNER JOIN FIN.ReceiveReceipt rr ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rcf.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rcf.PreVoucherID
                          WHERE     rcfi.[State] = 4
                                    AND rcf.[Date] <= @ToDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rcfi.ReceiptCheqeFlowItemID IN 
																	(
																	SELECT DISTINCT
																			rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 2
																			AND rbi.EntityID NOT IN 
																			(
																			SELECT DISTINCT
																					rbi2.EntityID
																			FROM    FIN.ReconciledBookItem rbi2
																			WHERE   rbi2.Passed = 1
																					AND rbi2.EntityType = 2 
																			) 
																	)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @CashFromBank EntityName ,
                                    3 EntityType ,
                                    rcfi.ReceiptCheqeFlowItemID EntityID ,
									rcfi.ReceiptCheqeFlowID MasterID,
									'ReceiptCheqeFlow' EngName,
                                    rc.Number Number ,
                                    rcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(rcf.[Date], 0) PersianDate ,
                                    rc.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceiptCheqeFlowItem rcfi
                                    LEFT JOIN FIN.ReceiptCheqeFlow rcf ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
                                    LEFT JOIN FIN.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
                                    LEFT JOIN FIN.ReceiveReceipt rr ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
									LEFT JOIN  FIN.ReceiptCheqeFlowItem pre on pre.ReceiptCheqeFlowItemID = rcfi.PreviousFlow
									LEFT JOIN  FIN.ReceiptCheqeFlow preH on preH.ReceiptCheqeFlowID = pre.ReceiptCheqeFlowid
									LEFT JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rcf.PreVoucherID
                          WHERE     rcfi.[State] = 6
                                    AND rcf.[Date] <= @ToDate
                                    AND rcf.[Date] >= @FromDate
                                    AND preH.BankAccountID = @SelectedBankAccount
                                    AND rcfi.ReceiptCheqeFlowItemID NOT IN 
																	(
																	SELECT  rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 3 
																	)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @CashFromBank EntityName ,
                                    3 EntityType ,
                                    rcfi.ReceiptCheqeFlowItemID EntityID ,
									rcfi.ReceiptCheqeFlowID MasterID,
									'ReceiptCheqeFlow' EngName,
                                    rc.Number Number ,
                                    rcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(rcf.[Date], 0) PersianDate ,
                                    rc.Amount Deposite ,
                                    0 WithDraw,
									rr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.ReceiptCheqeFlowItem rcfi
                                    LEFT JOIN FIN.ReceiptCheqeFlow rcf ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
                                    LEFT JOIN FIN.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
                                    LEFT JOIN FIN.ReceiveReceipt rr ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
									LEFT JOIN  FIN.ReceiptCheqeFlowItem pre on pre.ReceiptCheqeFlowItemID = rcfi.PreviousFlow
									LEFT JOIN  FIN.ReceiptCheqeFlow preH on preH.ReceiptCheqeFlowID = pre.ReceiptCheqeFlowid
									LEFT JOIN cfg.Party p on p.PartyID = rr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = rcf.PreVoucherID
                          WHERE     rcfi.[State] = 6
                                    AND rcf.[Date] <= @ToDate
                                    AND preH.BankAccountID = @SelectedBankAccount
                                    AND rcfi.ReceiptCheqeFlowItemID IN 
									(
                                    SELECT DISTINCT
                                            rbi.EntityID
                                    FROM    FIN.ReconciledBookItem rbi
                                    WHERE   rbi.EntityType = 3
                                            AND rbi.EntityID NOT IN 
											(
                                            SELECT DISTINCT
                                                    rbi2.EntityID
                                            FROM    FIN.ReconciledBookItem rbi2
                                            WHERE   rbi2.Passed = 1
                                                    AND rbi2.EntityType = 3 
											) 
									)

							
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @TransferToBank EntityName ,
                                    4 EntityType ,
                                    ps.PaymentSubjectID EntityID ,
									ps.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    CAST (pr.Number AS VARCHAR(100)) Number ,
                                    case when pbd.Date is not null then pbd.Date else pr.[Date] end [Date] ,
                                    CFG.GetSaturnDate(case when pbd.Date is not null then pbd.Date else pr.[Date] end, 0) PersianDate ,
                                    ps.Amount Deposite ,
                                    0 WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentSubject ps
						            join fin.PaymentType t on ps.PaymentTypeID = t.PaymentTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON ps.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON ps.DLID = ba.DlID
                                    LEFT JOIN ACC.DL dl ON ba.DlID = dl.DLID
									LEFT JOIN FIN.PaymentBankDraft pbd on pbd.PaymentBankDraftID = ps.PaymentBankDraftID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     t.Type = 4
                          and pr.[Status] <> 2
                                    AND case when pbd.Date is not null then pbd.Date else pr.[Date] end <= @ToDate
                                    AND case when pbd.Date is not null then pbd.Date else pr.[Date] end >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND ps.PaymentSubjectID NOT IN 
																(
																SELECT  rbi.EntityID
																FROM    FIN.ReconciledBookItem rbi
																WHERE   rbi.EntityType = 4 
																)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @TransferToBank EntityName ,
                                    4 EntityType ,
                                    ps.PaymentSubjectID EntityID ,
									ps.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    CAST (pr.Number AS VARCHAR(100)) Number ,
                                    pr.[Date] [Date] ,
                                    CFG.GetSaturnDate(pr.[Date], 0) PersianDate ,
                                    ps.Amount Deposite ,
                                    0 WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentSubject ps
						            join fin.PaymentType t on ps.PaymentTypeID = t.PaymentTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON ps.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON ps.DLID = ba.DlID
                                    LEFT JOIN ACC.DL dl ON ba.DlID = dl.DLID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     t.Type = 4
                          and pr.[Status] <> 2
                                    AND pr.[Date] <= @ToDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND ps.PaymentSubjectID IN 
															(
															SELECT DISTINCT
																	rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 4
																	AND rbi.EntityID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi2.EntityID
																	FROM    FIN.ReconciledBookItem rbi2
																	WHERE   rbi2.Passed = 1
																			AND rbi2.EntityType = 4 
																	) 
															)

								
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,	
								    @BankDraft EntityName ,
                                    5 EntityType ,
                                    pbd.PaymentBankDraftID EntityID ,
									pbd.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    pbd.Number Number ,
                                    pbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(pbd.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pbd.Amount + pbd.Wage WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentBankDraft pbd
                                    LEFT JOIN FIN.PaymentReceipt pr ON pbd.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pbd.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     pbd.[Date] <= @ToDate
                          and pr.[Status]<> 2
                                    AND pbd.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pbd.PaymentBankDraftID NOT IN
																(
																SELECT  rbi.EntityID
																FROM    FIN.ReconciledBookItem rbi
																WHERE   rbi.EntityType = 5 
																)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @BankDraft EntityName ,
                                    5 EntityType ,
                                    pbd.PaymentBankDraftID EntityID ,
									pbd.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    pbd.Number Number ,
                                    pbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(pbd.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pbd.Amount+ pbd.Wage WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentBankDraft pbd
                                    LEFT JOIN FIN.PaymentReceipt pr ON pbd.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pbd.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     pbd.[Date] <= @ToDate
                          and pr.[Status] <> 2
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pbd.PaymentBankDraftID IN 
															(
															SELECT DISTINCT
																	rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 5
																	AND rbi.EntityID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi2.EntityID
																	FROM    FIN.ReconciledBookItem rbi2
																	WHERE   rbi2.Passed = 1
																			AND rbi2.EntityType = 5 
																	)
															)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @TodayCheqe EntityName ,
                                    6 EntityType ,
                                    pc.PaymentCheqeID EntityID ,
									pc.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    pc.Number Number ,
                                    pc.[Date] [Date] ,
                                    CFG.GetSaturnDate(pc.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pc.Amount WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqe pc
									INNER JOIN FIN.PaymentCheqeType pct ON pct.PaymentCheqeTypeID = pc.PaymentCheqeTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     pc.[Date] <= @ToDate
                          and pr.[Status] <> 2
                                    AND pc.[Date] >= @FromDate
                                    AND pct.Today = 1
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pc.PaymentCheqeID NOT IN 
															(
															SELECT  rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 6 
															)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @TodayCheqe EntityName ,
                                    6 EntityType ,
                                    pc.PaymentCheqeID EntityID ,
									pc.PaymentReceiptID MasterID,
									'PaymentReceipt' EngName,
                                    pc.Number Number ,
                                    pc.[Date] [Date] ,
                                    CFG.GetSaturnDate(pc.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pc.Amount WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqe pc
									INNER JOIN FIN.PaymentCheqeType pct ON pct.PaymentCheqeTypeID = pc.PaymentCheqeTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pr.PreVoucherID
                          WHERE     pc.[Date] <= @ToDate
                          and pr.[Status] <> 2
                                    AND pct.Today = 1
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pc.PaymentCheqeID IN 
														(
														SELECT DISTINCT
																rbi.EntityID
														FROM    FIN.ReconciledBookItem rbi
														WHERE   rbi.EntityType = 6
																AND rbi.EntityID NOT IN 
																(
																SELECT DISTINCT
																		rbi2.EntityID
																FROM    FIN.ReconciledBookItem rbi2
																WHERE   rbi2.Passed = 1
																		AND rbi2.EntityType = 6 
																)
														)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @PaymentCheqeCashing EntityName ,
                                    7 EntityType ,									
                                    pcfi.PaymentCheqeFlowItemID EntityID ,
									pcfi.PaymentCheqeFlowID MasterID,
									'PaymentCheqeFlow' EngName,
                                    pc.Number Number ,
                                    pcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(pcf.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pc.Amount WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqeFlowItem pcfi
                                    LEFT JOIN FIN.PaymentCheqeFlow pcf ON pcfi.PaymentCheqeFlowID = pcf.PaymentCheqeFlowID
                                    LEFT JOIN FIN.PaymentCheqe pc ON pcfi.PaymentCheqeID = pc.PaymentCheqeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pcf.PreVoucherID
                          WHERE     pcf.[Type] = 0
                                    AND pcf.[Date] <= @ToDate
                                    AND pcf.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pcfi.PaymentCheqeFlowItemID NOT IN 
																		(
																		SELECT  rbi.EntityID
																		FROM    FIN.ReconciledBookItem rbi
																		WHERE   rbi.EntityType = 7 
																		)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @PaymentCheqeCashing EntityName ,
                                    7 EntityType ,
                                    pcfi.PaymentCheqeFlowItemID EntityID ,
									pcfi.PaymentCheqeFlowID MasterID,
									'PaymentCheqeFlow' EngName,
                                    pc.Number Number ,
                                    pcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(pcf.[Date], 0) PersianDate ,
                                    0 Deposite ,
                                    pc.Amount WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqeFlowItem pcfi
                                    LEFT JOIN FIN.PaymentCheqeFlow pcf ON pcfi.PaymentCheqeFlowID = pcf.PaymentCheqeFlowID
                                    LEFT JOIN FIN.PaymentCheqe pc ON pcfi.PaymentCheqeID = pc.PaymentCheqeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pcf.PreVoucherID
                          WHERE     pcf.[Type] = 0
                                    AND pcf.[Date] <= @ToDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pcfi.PaymentCheqeFlowItemID IN 
																	(
																	SELECT DISTINCT
																			rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 7
																			AND rbi.EntityID NOT IN 
																			(
																			SELECT DISTINCT
																					rbi2.EntityID
																			FROM    FIN.ReconciledBookItem rbi2
																			WHERE   rbi2.Passed = 1
																					AND rbi2.EntityType = 7 
																			) 
																	)
							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    case when bi.Deposite > 0 then N'واریز' else @BankDraft end + ' - ' + bi.[Description] EntityName ,
                                    8 EntityType ,
                                    bi.BookItemID EntityID ,
									bi.BookID MasterID,
									'Book' EngName,
                                    bi.Number ,
                                    bi.[Date] ,
                                    CFG.GetSaturnDate(bi.[Date], 0) PersianDate ,
                                    bi.Deposite ,
                                    bi.Withdraw,
									null,
									null,
									null,
									null
                          FROM      FIN.BookItem bi
                                    LEFT JOIN FIN.Book b ON b.BookID = bi.BookID
                          WHERE     b.BookID = @BookId
                                    AND bi.BookItemID NOT IN 
														(
														SELECT  rbi.EntityID
														FROM    FIN.ReconciledBookItem rbi
														WHERE   EntityType = 8
																AND rbi.Passed = 1 
														)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @DrawBackedCheque EntityName ,
                                    9 EntityType ,
                                    pcfi.PaymentCheqeFlowItemID EntityID ,
									pcfi.PaymentCheqeFlowID MasterID,
									'PaymentCheqeFlow' EngName,
                                    pc.Number Number ,
                                    pcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(pcf.[Date], 0) PersianDate ,
                                    pc.Amount Deposite ,
                                    0 WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqeFlowItem pcfi
                                    LEFT JOIN FIN.PaymentCheqeFlow pcf ON pcfi.PaymentCheqeFlowID = pcf.PaymentCheqeFlowID
                                    LEFT JOIN FIN.PaymentCheqe pc ON pcfi.PaymentCheqeID = pc.PaymentCheqeID
									LEFT JOIN FIN.PaymentCheqeType pct on pc.PaymentCheqeTypeID = pct.PaymentCheqeTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pcf.PreVoucherID
                          WHERE     pcf.[Type] = 1
                                    AND pcf.[Date] <= @ToDate
                                    AND pcf.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pct.Today = 1
                                    AND pcfi.PaymentCheqeFlowItemID NOT IN 
																	(
																	SELECT  rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 9 
																	)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @DrawBackedCheque EntityName ,
                                    9 EntityType ,
                                    pcfi.PaymentCheqeFlowItemID EntityID ,
									pcfi.PaymentCheqeFlowID MasterID,
									'PaymentCheqeFlow' EngName,
                                    pc.Number Number ,
                                    pcf.[Date] [Date] ,
                                    CFG.GetSaturnDate(pcf.[Date], 0) PersianDate ,
                                    pc.Amount Deposite ,
                                    0 WithDraw,
									pr.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
                          FROM      FIN.PaymentCheqeFlowItem pcfi
                                    LEFT JOIN FIN.PaymentCheqeFlow pcf ON pcfi.PaymentCheqeFlowID = pcf.PaymentCheqeFlowID
                                    LEFT JOIN FIN.PaymentCheqe pc ON pcfi.PaymentCheqeID = pc.PaymentCheqeID
									LEFT JOIN FIN.PaymentCheqeType pct on pc.PaymentCheqeTypeID = pct.PaymentCheqeTypeID
                                    LEFT JOIN FIN.PaymentReceipt pr ON pc.PaymentReceiptID = pr.PaymentReceiptID
                                    LEFT JOIN CFG.BankAccount ba ON pc.BankAccountID = ba.BankAccountID
									LEFT JOIN cfg.Party p on p.PartyID = pr.PartyID
									LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = pcf.PreVoucherID
                          WHERE     pcf.[Type] = 1
                                    AND pcf.[Date] <= @ToDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND pct.Today = 1
                                    AND pcfi.PaymentCheqeFlowItemID IN 
																	(
																	SELECT DISTINCT
																			rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 9
																			AND rbi.EntityID NOT IN
																			(
																			SELECT DISTINCT
																					rbi2.EntityID
																			FROM    FIN.ReconciledBookItem rbi2
																			WHERE   rbi2.Passed = 1
																					AND rbi2.EntityType = 9 
																			) 
																	)

							INSERT  INTO #ReconciledBookTemp
							SELECT     -1 ReconciliationID ,
									   N'وصول ضمانت نامه' EntityName,
                                       10 EntityType,
                                       g.GuarantyOperationID EntityID,
									   g.GuarantyOperationID MasterID,
									   'GuarantyOperation' EngName,
                                       cast(g.Number as varchar(50)) Number,
                                       g.[date] [Date],
                                       CFG.GetSaturnDate(g.[date], 0) PersianDate,
                                       rgc.Amount - isnull(g2.DeductedAmount, 0) Deposite,
                                       0 WithDraw,
										rc.PartyID,
										p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
										vw.VoucherID,
										vw.Number VoucherNumber
								from FIN.GuarantyOperation g
								left join FIN.ReceiveGuarantyCommitment rgc on g.ReceiveGuarantyCommitmentID = rgc.ReceiveGuarantyCommitmentID
								left join FIN.ReceiveCommitment rc on rc.ReceiveCommitmentID = rgc.ReceiveCommitmentID
								left join CFG.BankAccount b on b.BankAccountID = g.BankAccountID
								left join (select ReceiveGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
											from FIN.GuarantyOperation 
											where CommitmentType = 1 and OperationType = 2 
											group by ReceiveGuarantyCommitmentID) g2 on g.ReceiveGuarantyCommitmentID = g2.ReceiveGuarantyCommitmentID
								LEFT JOIN cfg.Party p on p.PartyID = rc.PartyID
								LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = g.PreVoucherID
								where g.CommitmentType = 1 and g.OperationType = 4 and
								b.BankAccountID = @SelectedBankAccount and
								g.[date] >= @FromDate and g.[date] <= @ToDate and
                                g.GuarantyOperationID NOT IN 
														(
															SELECT  rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 10
														)
							INSERT  INTO #ReconciledBookTemp
							SELECT     -1 ReconciliationID ,
									   N'وصول ضمانت نامه' EntityName,
                                       10 EntityType,
                                       g.GuarantyOperationID EntityID,
									   g.GuarantyOperationID MasterID,
									   'GuarantyOperation' EngName,
                                       cast(g.Number as varchar(50)) Number,
                                       g.[date] [Date],
                                       CFG.GetSaturnDate(g.[date], 0) PersianDate,
                                       rgc.Amount - isnull(g2.DeductedAmount, 0) Deposite,
                                       0 WithDraw,
										rc.PartyID,
										p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
										vw.VoucherID,
										vw.Number VoucherNumber
								from FIN.GuarantyOperation g
								left join FIN.ReceiveGuarantyCommitment rgc on g.ReceiveGuarantyCommitmentID = rgc.ReceiveGuarantyCommitmentID
								left join FIN.ReceiveCommitment rc on rc.ReceiveCommitmentID = rgc.ReceiveCommitmentID
								left join CFG.BankAccount b on b.BankAccountID = g.BankAccountID
								left join (select ReceiveGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
											from FIN.GuarantyOperation 
											where CommitmentType = 1 and OperationType = 2 
											group by ReceiveGuarantyCommitmentID) g2 on g.ReceiveGuarantyCommitmentID = g2.ReceiveGuarantyCommitmentID
								LEFT JOIN cfg.Party p on p.PartyID = rc.PartyID
								LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = g.PreVoucherID
								where g.CommitmentType = 1 and g.OperationType = 4 and
								b.BankAccountID = @SelectedBankAccount and
								g.[date] <= @ToDate and
                                g.GuarantyOperationID IN 
														(
															SELECT DISTINCT
																	rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 10
																	AND rbi.EntityID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi2.EntityID
																	FROM    FIN.ReconciledBookItem rbi2
																	WHERE   rbi2.Passed = 1
																			AND rbi2.EntityType = 10 
																	) 
														)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
									N'وصول ضمانت نامه' EntityName,
                                    11 EntityType,
                                    g.GuarantyOperationID EntityID,									
									g.GuarantyOperationID MasterID,
									'GuarantyOperation' EngName,
                                    cast(g.Number as varchar(50)) Number,
                                    g.[date] [Date],
                                    CFG.GetSaturnDate(g.[date], 0) PersianDate,
                                    0 Deposite,
                                    pgc.Amount - isnull(g2.DeductedAmount,0) WithDraw,
									pc.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
							from FIN.GuarantyOperation g
							left join FIN.PaymentGuarantyCommitment pgc on g.PaymentGuarantyCommitmentID = pgc.PaymentGuarantyCommitmentID
							left join FIN.PaymentCommitment pc on pc.PaymentCommitmentID = pgc.PaymentCommitmentID
							left join CFG.BankAccount b on b.BankAccountID = g.BankAccountID
							left join (select PaymentGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
										from FIN.GuarantyOperation 
										where CommitmentType = 2 and OperationType = 2 
										group by PaymentGuarantyCommitmentID) g2 on g.PaymentGuarantyCommitmentID = g2.PaymentGuarantyCommitmentID
							LEFT JOIN cfg.Party p on p.PartyID = pc.PartyID
							LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = g.PreVoucherID
							where g.CommitmentType = 2 and g.OperationType = 4 and 
                                g.[Date] >= @FromDate and g.[Date] <= @ToDate and 
                                b.BankAccountID = @SelectedBankAccount and 
                                g.GuarantyOperationID NOT IN 
														(
															SELECT  rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 11 
														)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    N'وصول ضمانت نامه' EntityName,
                                    11 EntityType,
                                    g.GuarantyOperationID EntityID,
									g.GuarantyOperationID MasterID,
									'GuarantyOperation' EngName,
                                    cast(g.Number as varchar(50)) Number,
                                    g.[date] [Date],
                                    CFG.GetSaturnDate(g.[date], 0) PersianDate,
                                    0 Deposite,
                                    pgc.Amount - isnull(g2.DeductedAmount,0) WithDraw,
									pc.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									vw.VoucherID,
									vw.Number VoucherNumber
							from FIN.GuarantyOperation g
							left join FIN.PaymentGuarantyCommitment pgc on g.PaymentGuarantyCommitmentID = pgc.PaymentGuarantyCommitmentID
							left join FIN.PaymentCommitment pc on pc.PaymentCommitmentID = pgc.PaymentCommitmentID
							left join CFG.BankAccount b on b.BankAccountID = g.BankAccountID
							left join (select PaymentGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
										from FIN.GuarantyOperation 
										where CommitmentType = 2 and OperationType = 2 
										group by PaymentGuarantyCommitmentID) g2 on g.PaymentGuarantyCommitmentID = g2.PaymentGuarantyCommitmentID
							LEFT JOIN cfg.Party p on p.PartyID = pc.PartyID
							LEFT JOIN #VWVoucherPrevoucher vw on vw.PrevoucherID = g.PreVoucherID
							where g.CommitmentType = 2 and g.OperationType = 4 and 
                                g.[Date] <= @ToDate and 
                                b.BankAccountID = @SelectedBankAccount and 
                                g.GuarantyOperationID IN
														(
															SELECT DISTINCT
																	rbi.EntityID
															FROM    FIN.ReconciledBookItem rbi
															WHERE   rbi.EntityType = 11
																	AND rbi.EntityID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi2.EntityID
																	FROM    FIN.ReconciledBookItem rbi2
																	WHERE   rbi2.Passed = 1
																			AND rbi2.EntityType = 11
																	)
														)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @Outgoing EntityName ,
                                    12 EntityType ,
                                    rbd.PosReceiptItemID EntityID ,
									rbd.PosReceiptID MasterID,
									'PosReceipt' EngName,
                                    rbd.TracingNumber Number ,
                                    rbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(rbd.[Date], 0) PersianDate ,
                                    rbd.Amount Deposite ,
                                    0 WithDraw,
									p.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									null,
									null VoucherNumber
                          FROM      pos.PosReceiptItem rbd
                                    INNER JOIN pos.PosReceipt rr ON rbd.PosReceiptID = rr.PosReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rbd.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.CustomerID
                          WHERE     rbd.[Date] <= @ToDate
									AND rbd.ItemType = 6
                                    AND rbd.[Date] >= @FromDate
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rbd.PosReceiptItemID NOT IN 
																	(
																	SELECT DISTINCT
																			rbi.EntityID
																	FROM    FIN.ReconciledBookItem rbi
																	WHERE   rbi.EntityType = 12
																	)

							INSERT  INTO #ReconciledBookTemp
							SELECT  -1 ReconciliationID ,
								    @Outgoing EntityName ,
                                    12 EntityType ,
                                    rbd.PosReceiptItemID EntityID ,
									rbd.PosReceiptID MasterID,
									'PosReceipt' EngName,
                                    rbd.TracingNumber Number ,
                                    rbd.[Date] [Date] ,
                                    CFG.GetSaturnDate(rbd.[Date], 0) PersianDate ,
                                    rbd.Amount Deposite ,
                                    0 WithDraw,
									p.PartyID,
									p.Title + ' ' + ISNULL(p.LastName,'') PartyName,
									null,
									null VoucherNumber
                          FROM      pos.PosReceiptItem rbd
                                    INNER JOIN pos.PosReceipt rr ON rbd.PosReceiptID = rr.PosReceiptID
                                    INNER JOIN CFG.BankAccount ba ON rbd.BankAccountID = ba.BankAccountID
									INNER JOIN cfg.Party p on p.PartyID = rr.CustomerID
                          WHERE     rbd.[Date] <= @ToDate
									AND rbd.ItemType = 6
                                    AND ba.BankAccountID = @SelectedBankAccount
                                    AND rbd.PosReceiptItemID IN 
																(
																SELECT DISTINCT
																		rbi.EntityID
																FROM    FIN.ReconciledBookItem rbi
																WHERE   rbi.EntityType = 12
																		AND rbi.EntityID NOT IN 
																		(
																		SELECT DISTINCT
																				rbi2.EntityID
																		FROM    FIN.ReconciledBookItem rbi2
																		WHERE   rbi2.Passed = 1
																				AND rbi2.EntityType = 12
																		) 
																)
                          

             
	
	
        CREATE TABLE #ReturnReconciledBookTable
            (
              ReconciledBookItemID INT ,
              EntityName nvarchar(1050) ,
              EntityType TINYINT ,
              EntityID INT ,
			  MasterID int,
			  EngName nvarchar(50),
              Number NVARCHAR(100) ,
              [Date] DATE ,
              PersianDate NVARCHAR(20) ,
              Deposite DECIMAL(30, 4) ,
              Withdraw DECIMAL(30, 4),
			  PartyID bigint ,
			  PartyName nvarchar(1050) ,
			  VoucherID INT ,
			  VoucherNumber NVARCHAR(200) 
            )
	
        INSERT  INTO #ReturnReconciledBookTable
                SELECT  ROW_NUMBER() OVER ( ORDER BY B.[Date], B.EntityType, B.EntityID ) ReconciledBookItemID ,
                        B.EntityName ,
                        B.EntityType ,
                        B.EntityID ,
						B.MasterID,
						B.EngName,
                        B.Number ,
                        B.[Date] ,
                        CFG.GetSaturnDate(B.[Date], 0) PersianDate ,
                        B.Deposite ,
                        B.Withdraw,
						PartyID,
						PartyName,
						VoucherID,
						VoucherNumber
                FROM    #ReconciledBookTemp B
	
	
        SELECT  CAST(ROW_NUMBER() OVER ( ORDER BY A.Date ) AS INT) ReconciledBookItemID ,
                A.*
        FROM    ( SELECT    RRBT.EntityType ,
                            RRBT.EntityID ,
							RRBT.MasterID,
							RRBT.EngName,
                            RRBT.Number ,
                            RRBT.Deposite ,
                            RRBT.Withdraw ,
                            RRBT.PersianDate ,
                            RRBT.Date ,
                            RRBT.EntityName,
							RRBT.PartyID,
							RRBT.PartyName,
							RRBT.VoucherID,
							RRBT.VoucherNumber
                  FROM      #ReturnReconciledBookTable RRBT
                  GROUP BY  RRBT.EntityType ,
                            RRBT.EntityID ,
							RRBT.MasterID,
							RRBT.EngName,
                            RRBT.Number ,
                            RRBT.Deposite ,
                            RRBT.Withdraw ,
                            RRBT.PersianDate ,
                            RRBT.Date ,
                            RRBT.EntityName,
							RRBT.PartyID,
							RRBT.PartyName,
							RRBT.VoucherID,
							RRBT.VoucherNumber
                ) A
	
        DROP TABLE #ReconciledBookTemp
        DROP TABLE #ReturnReconciledBookTable
	
    END

