    
----- End #Notask
	
----------------Start #NoTask
CREATE   
PROCEDURE [FIN].spGetReceivedCheqes
(
	@type tinyint,
	@BranchID int,
	@PartyID bigint = null,
	@CurrencyID int = null,
	@Date date,
	@BankAccountID int = null
)	
--WITH ENCRYPTION
AS
BEGIN
		
	DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo tinyint	

    SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type' AND us.UserID = @UserID
	
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format' AND us.UserID = @UserID
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'
	
	IF OBJECT_ID('tempdb..#LatestFlow') IS Not NULL
		DROP TABLE #LatestFlow

	IF OBJECT_ID('tempdb..#Parties') IS Not NULL
		DROP TABLE #Parties

	select * 
	into #LatestFlow
	from (select ROW_NUMBER() OVER(PARTITION BY i.ReceivedCheqeID ORDER BY f.ReceiptCheqeFlowID desc) rno,i.ReceivedCheqeID,f.[Date],i.ReceiptCheqeFlowItemID
	      from FIN.ReceiptCheqeFlowItem i
	      join fin.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID) T
	where T.rno = 1

	select p.PartyID,
	       d.Code PartyCode,
		   CAST(case when p.[Type] = 1 or p.[Type] = 2 then p.Title
					 when p.[Type] = 0 then p.Title+' '+p.LastName
		   end as NVARCHAR(512))as PartyTitle,
		   CAST(case when p.[Type] = 1 or p.[Type] = 2 then p.Title2
					 when p.[Type] = 0 then p.Title2+' '+p.LastName2
		   end as NVARCHAR(512))as PartyTitle2,
		   p.DlID
	into #Parties
	from CFG.Party p
	left join ACC.DL d on p.DlID = d.DLID
	
	select * into #vwEnums from cfg.VwEnums
	where Enum = 'CheqeStateInReceive'
	and KeyValue is not null

	

	select * into #vwReceivedCheque
	FROM fin.vwReceivedCheque AS vrc
	WHERE  branchid = @BranchID

	option (recompile)
	


	--واگذار به بانک
	IF (@type = 0)
	BEGIN
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,					
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque rr		
		join #vwEnums AS ve on rr.LastState = ve.KeyValue 
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID	
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE rr.BranchID = @BranchID 
		and rr.CurrencyID = @CurrencyID 
		and	(rr.LastState = 0 or rr.LastState = 7 or rr.LastState = 8) 
		and (l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date  
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )	
	END
	
	--استرداد
	IF (@type = 1)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		FROM #vwReceivedCheque rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID		
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID	
		WHERE rr.BranchID = @BranchID 
		and rr.PartyID = @PartyID 
		and(rr.LastState = 0 or rr.LastState = 7) 
		and(l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )
	END	

	--نقد به بانک
	IF (@type = 2)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		FROM #vwReceivedCheque rr	
		join #vwEnums AS ve on rr.LastState = ve.KeyValue	
	    JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID	
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID		
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID	
		JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE rr.BranchID = @BranchID 
		and rr.CurrencyID = @CurrencyID 
		and(rr.LastState = 0 or rr.LastState = 7 or rr.LastState = 8) 
		and (l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )	
	END
	
	
	--نقد به صندوق
	IF (@type = 3)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue		
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID	
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID	
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID	
		WHERE rr.BranchID = @BranchID 
		and (rr.LastState = 0 or rr.LastState = 7 or rr.LastState = 8) 
		and (l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )
        	
	END
	
	
	
	--برگشت خرج
	IF (@type = 4)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
		JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID and l.rno = 1
		JOIN FIN.PaymentOtherCheqe poc on rr.ReceivedCheqeID = poc.ReceivedCheqeID and poc.ReceiptCheqeFlowItemID = l.ReceiptCheqeFlowItemID
		JOIN FIN.PaymentReceipt pr on pr.PaymentReceiptID = poc.PaymentReceiptID	
		JOIN #Parties p on pr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE pr.BranchID = @BranchID 
		and pr.PartyID = @PartyID 
		and rr.LastState = 5 
		and (l.ReceivedCheqeID is null or l.[Date] <= @Date) 
        	
	END
	
	--وصول و واخواست
	IF (@type = 5)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow,
						dl.Code BankAccountCode,
						case @CultureNo 
							when 1 then dl.Title
							when 2 then dl.Title2
						end as BankAccountTitle
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue		
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN FIN.ReceiptCheqeFlowItem rcfi on rr.LastFlow = rcfi.ReceiptCheqeFlowItemID
		LEFT JOIN FIN.ReceiptCheqeFlow rcf on rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
		LEFT JOIN CFG.BankAccount ba on rcf.BankAccountID = ba.BankAccountID
		LEFT JOIN ACC.DL dl on ba.DlID = dl.DLID	
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE rr.BranchID = @BranchID 
		and rr.LastState = 1 
		and	rcfi.ReceivedCheqeID = rr.ReceivedCheqeID 
		and rcfi.[State] = 1 
		and rcf.[Date] <= @Date
        	
	END
	

	-- تحویل به کارپرداز
	IF (@type = 6)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue		
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID	
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID	
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID		
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE rr.BranchID = @BranchID 
		and (rr.LastState = 0 or rr.LastState = 7) 
		and	(l.ReceivedCheqeID is null or l.[Date] <= @Date) 
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )
        
	END
	
	
	--واگذار استقراری
	IF (@type = 7)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue		
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID	
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID		
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID	
		WHERE rr.BranchID = @BranchID 
		and rr.[Status] = 1 
		and rr.CurrencyID = @CurrencyID 
		and rr.LastState = 0 
		and	(l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2)
       	
	END
	
	--واخواست استقراری
	IF (@type = 8)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID	
		LEFT JOIN FIN.ReceiptCheqeFlowItem rcfi on rr.LastFlow = rcfi.ReceiptCheqeFlowItemID
		LEFT JOIN FIN.ReceiptCheqeFlow rcf on rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID		
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID
		WHERE rr.BranchID = @BranchID 
		and rr.LastState = 1 
		and	rr.ReceivedCheqeID = rcfi.ReceivedCheqeID 
		and rcf.[Type] = 7 
		and rcf.[Date] <= @Date  
       	
	END
	
	--خرج چک
	IF (@type = 9)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow,
						cast(case when rr.[Status] = 1 then 1
						          when rr.[Status] = 0 then 0
							 end as bit) IsInitial
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
		JOIN #Parties p on rr.PartyID = p.PartyID	
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID
		LEFT JOIN #LatestFlow l on rr.ReceivedCheqeID = l.ReceivedCheqeID
		left join FIN.vwLatestCashTransfersStatus vw on rr.ReceivedCheqeID = vw.ReceivedCheqeID	
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID	
		WHERE rr.BranchID = @BranchID 
		and (rr.LastState = 0 or rr.LastState = 7) 
		and	(l.ReceivedCheqeID is null or l.[Date] <= @Date)
		and rr.ReceiveDate <= @Date
		and (vw.ReceivedCheqeID is null or vw.Status = 2 )	
	END

	--برگشت از واگذاری
	IF (@type = 10)
	BEGIN
	
		SELECT DISTINCT rr.ReceivedCheqeID,
						rr.Number,
						CFG.GetCLRSaturnDate(rr.[Date],@DateFormat,0,@DateType) PersianDate,
						rr.CurrencyID,
						case @CultureNo 
							when 1 then cu.Title
							when 2 then cu.Title2
						end as CurrencyName,
						rr.CurrencyRate,
						rr.Amount,
						p.PartyCode,
						case @CultureNo 
							when 1 then p.PartyTitle
							when 2 then p.PartyTitle2
						end as PartyTitle,
						ve.[Value] LastStateCheqe,
						rr.LastFlow
		
		FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
		JOIN #Parties p on rr.PartyID = p.PartyID
		JOIN CFG.Currency cu on rr.CurrencyID = cu.CurrencyID	
		LEFT JOIN FIN.ReceiptCheqeFlowItem rcfi on rr.LastFlow = rcfi.ReceiptCheqeFlowItemID
		LEFT JOIN FIN.ReceiptCheqeFlow rcf on rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID	
		INNER JOIN cfg.vwCashAccess AS vca ON vca.CashID = rr.CashID	
		WHERE rr.BranchID = @BranchID 
		and rr.LastState = 1 
		and rcfi.[State] = 1 
		and rcf.BankAccountID = @BankAccountID 
		and rcf.[Date] <= @Date
       		
	END

	--استرداد چک فروشگاهی
	IF (@type = 11)
	BEGIN
	
	      SELECT DISTINCT
               rr.ReceivedCheqeID,
               rr.Number,
               CFG.GetCLRSaturnDate(rr.[Date], @DateFormat, 0, @DateType) PersianDate,
               rr.CurrencyID,
               CASE @CultureNo
                   WHEN 2 THEN cu.Title2
                   ELSE cu.Title
               END AS CurrencyName,
               rr.CurrencyRate,
               rr.Amount,
               p.PartyCode,
               CASE @CultureNo
                   WHEN 2 THEN p.PartyTitle2
				   ELSE p.PartyTitle
               END AS PartyTitle,
               ve.[Value] LastStateCheqe,
               rr.LastFlow
        FROM #vwReceivedCheque AS rr
		join #vwEnums AS ve on rr.LastState = ve.KeyValue
            JOIN CFG.Currency AS cu
                ON cu.CurrencyID = rr.CurrencyID          
            LEFT JOIN #LatestFlow l
                ON rr.ReceivedCheqeID = l.ReceivedCheqeID
            LEFT JOIN FIN.vwLatestCashTransfersStatus vw
                ON rr.ReceivedCheqeID = vw.ReceivedCheqeID
            LEFT JOIN #Parties AS p
                ON p.PartyID = rr.PartyID
        WHERE rr.BranchID = @BranchID
              AND rr.PartyID = @PartyID
              And rr.ChequeSource = 'PosCheque'
              AND
              (
                  rr.LastState = 0
                  OR rr.LastState = 7
              )
              AND
              (
                  l.ReceivedCheqeID IS NULL
                  OR l.[Date] <= @Date
              )
              AND rr.ReceiveDate <= @Date
              AND
              (
                  vw.ReceivedCheqeID IS NULL
                  OR
                      vw.Status = 2
              );
	END

	IF OBJECT_ID('tempdb..#LatestFlow') IS Not NULL
		DROP TABLE #LatestFlow

	IF OBJECT_ID('tempdb..#Parties') IS Not NULL
		DROP TABLE #Parties
		
END
