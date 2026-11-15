
CREATE   PROC NOC.spGetCurrencyExchangeData
(
	@AnalysingID int
)
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @user INT,
			@Culture VARCHAR(5),
			@CultureNo TINYINT

	set @user = cfg.GetuserID()
	set @Culture = cfg.GetuserCulture()

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo 
	WHERE Culture = @Culture

	select p.PartyID,
	       d.Code PartyCode,
		   CASE WHEN @CultureNo = 1 then d.Title else d.Title2 end AS PartyName
	into #Parties
	from CFG.Party p
	left join ACC.DL d on p.DlID = d.DLID

	select a.ConfirmStatementID,dl.Code,d.Number
	into #ConfirmStatement
	from CNT.ConfirmStatement a
	join cnt.Contract on a.ContractID = Contract.ContractID
	join acc.dl on dl.DLID = Contract.DLID
	join cnt.ContractStatement d
		on d.ContractStatementID = a.ContractStatementID

	select b.ConfirmStatementID,dl.Code,d.Number
	into #ConfirmStatementItem
	from cnt.ConfirmStatementItem a
	join cnt.ConfirmStatement b
		on a.ConfirmStatementID = b.ConfirmStatementID
	join cnt.Contract c
		on c.ContractID = b.ContractID
	join acc.dl 
		on dl.DLID = c.DLID
	join cnt.ContractStatement d
		on d.ContractStatementID = b.ContractStatementID

	SELECT a.ContractStatementID,dl.Code,a.Number
	INTO  #ContractStatement
	FROM  CNT.ContractStatement a
		JOIN  cnt.Contract on a.ContractID = Contract.ContractID
		JOIN  acc.dl on dl.DLID = Contract.DLID

	select ce.CurrencyExchangeID,
	       ce.AnalysingID,
		   ce.RowIndex,
		   ac.ReferenceNumber AccrueVoucher,
		   ca.ReferenceNumber CashVoucher,
		   ce.SlID,
		   ACC.SlFullCode(ce.SlID) SlCode,		   
		   case @CultureNo when 2 then s.Title2 else s.Title end as SlTitle,
		   ce.ExchangeGainLoss,
		   ACC.SlFullCode(ce.ExchangeGainLoss) ExchangeGainLossSlCode,		   
		   case @CultureNo when 2 then s2.Title2 else s2.Title end as ExchangeGainLossSlTitle,
		   ce.Value,
		   ce.Creator,
		   ce.CreationDate,
		   ce.Version,
		   ce.PartyID,
		   pa.PartyCode,
		   pa.PartyName,
		   ce.ContractID,
		   cd.Code AS ContractDlCode,
		   CASE WHEN @CultureNo = 2
				THEN cd.Title2 
				ELSE cd.Title
		   END ContractDlTitle
	FROM NOC.CurrencyExchange ce
		JOIN acc.Voucher ac on ac.VoucherID = ce.AccrueVoucherID
		JOIN acc.Voucher ca on ca.VoucherID = ce.CashVoucherID
		join ACC.SL s on ce.SlID = s.SlID
		LEFT JOIN ACC.SL s2 on ce.ExchangeGainLoss = s2.SlID
		LEFT JOIN #Parties pa 
			on ce.PartyID = pa.PartyID
		LEFT JOIN CNT.[Contract] c
			ON c.ContractID = ce.ContractID
		LEFT JOIN ACC.DL cd
			ON cd.DLID = c.DLID
	WHERE AnalysingID = @AnalysingID
END;
