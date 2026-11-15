
--------------------------------------------------
CREATE   PROCEDURE FIN.spGetReceivedCheqesForCashTransfer
(
	@Type TINYINT,
	@BranchID INT,
	@Date DATE,
	@SourceCashID INT,
	@TargetCashID INT
)
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo TINYINT,
			@ProtestCheckStatusCaption nvarchar(250),			
			@ReceivedCheckStatusCaption nvarchar(250),
			@DrawBackStatusCaption nvarchar(250);

	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

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
							ELSE
								2
						END;

	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	SELECT p.PartyID,
		   d.Code PartyCode,
		   CAST(CASE
					WHEN p.Type = 1
						 OR p.Type = 2 THEN
						p.Title
					WHEN p.Type = 0 THEN
						p.Title + ' ' + p.LastName
					ELSE
						''
				END AS NVARCHAR(512)) AS PartyTitle,
		   CAST(CASE
					WHEN p.Type = 1
						 OR p.Type = 2 THEN
						p.Title2
					WHEN p.Type = 0 THEN
						p.Title2 + ' ' + p.LastName2
					ELSE
						''
				END AS NVARCHAR(512)) AS PartyTitle2
	INTO #Parties
	FROM CFG.Party p
		LEFT JOIN ACC.DL d
			ON p.DlID = d.DLID;

select @ProtestCheckStatusCaption = a.Value from cfg.LocalizeEnumValue a
join cfg.LocalizeEnum b on a.LocalizeEnumID = b.LocalizeEnumID
where b.enum = 'CheqeStateInReceive' and b.Item = 'Protest' and a.Culture = @Culture

select @ReceivedCheckStatusCaption = a.Value from cfg.LocalizeEnumValue a
join cfg.LocalizeEnum b on a.LocalizeEnumID = b.LocalizeEnumID
where b.enum = 'CheqeStateInReceive' and b.Item = 'Receive' and a.Culture = @Culture

select @DrawBackStatusCaption = a.Value from cfg.LocalizeEnumValue a
join cfg.LocalizeEnum b on a.LocalizeEnumID = b.LocalizeEnumID
where b.enum = 'CheqeStateInReceive' and b.Item = 'DrawBack' and a.Culture = @Culture

	--ارسال
	IF (@Type = 1)
	BEGIN

		SELECT DISTINCT
			   rc.ReceivedCheqeID,
			   rc.Number,
			   CFG.GetCLRSaturnDate(rc.[Date], @DateFormat, 0, @DateType) PersianDate,
			   rc.Amount,
			   p.PartyCode,
			   CASE @CultureNo
				   WHEN 2 THEN
					   p.PartyTitle2
				   ELSE
					   p.PartyTitle
			   END AS PartyTitle,
			   case @CultureNo when 2 then c.Title else c.Title2 end
			   CurrencyName,
			  case  rc.LastState when 0 then @ReceivedCheckStatusCaption when 7 then @ProtestCheckStatusCaption when 2 then @DrawBackStatusCaption end LastStateCheqe
		FROM FIN.ReceivedCheqe rc
		join cfg.Currency c on rc.CurrencyID = c.CurrencyID
			JOIN FIN.ReceiveReceipt rr
				ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
			JOIN #Parties p
				ON rr.PartyID = p.PartyID
			LEFT JOIN FIN.vwLatestCashTransfersStatus vw
				ON rc.ReceivedCheqeID = vw.ReceivedCheqeID
		WHERE rr.BranchID = @BranchID
			  AND rc.LastState in( 0,7)
			  AND rr.Date <= @Date
			  AND
			  (
				  vw.ReceivedCheqeID IS NULL
				  OR vw.Status = 2
			  )
			  AND
			  (
				  (
					  vw.ReceivedCheqeID IS NULL
					  AND rc.CashID = @SourceCashID
				  )
				  OR
				  (
					  vw.ReceivedCheqeID IS NOT NULL
					  AND vw.TargetCashID = @SourceCashID
				  )
			  );

	END;

	--تحویل 
	IF (@Type = 2)
	BEGIN
		SELECT DISTINCT
			   rc.ReceivedCheqeID,
			   rc.Number,
			   CFG.GetCLRSaturnDate(rc.[Date], @DateFormat, 0, @DateType) PersianDate,
			   rc.Amount,
			   p.PartyCode,
			   rc.LastState,
			   CASE @CultureNo
				   WHEN 2 THEN
					   p.PartyTitle2
				   ELSE
					   p.PartyTitle
			   END AS PartyTitle
		FROM FIN.ReceivedCheqe rc
			JOIN FIN.ReceiveReceipt rr
				ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
			JOIN #Parties p
				ON rr.PartyID = p.PartyID
			JOIN FIN.vwLatestCashTransfersStatus vw
				ON rc.ReceivedCheqeID = vw.ReceivedCheqeID
		WHERE rc.LastState = 0
			  AND rr.BranchID = @BranchID
			  AND rr.Date <= @Date
			  AND vw.Status = 1
			  AND vw.SourceCashID = @SourceCashID
			  AND vw.TargetCashID = @TargetCashID;
	END;
END;
