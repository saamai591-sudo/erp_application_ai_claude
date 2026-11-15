
CREATE     proc STM.SpRptPaymentReceiptCash
@PaymentReceiptID nvarchar(max)
--WITH ENCRYPTION
AS


declare @CultureNo int,
		@Culture varchar(50)

	set @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo

	where Culture = @Culture
CREATE TABLE #Ids
(id INT)

insert into #Ids
SELECT [value]
 FROM   cfg.R_FnCommaStr2Table(@PaymentReceiptID)
 ------------------
select
A.Amount CashAmount,
A.RowIndex CashRowIndex,
case when @CultureNo = 1 then A.Description 
	 when @CultureNo = 2 then A.Description2 end DescriptionPaymentCash,
case when @CultureNo = 1 then E.Title
	 when @CultureNo = 2 then E.Title2 end  CashTitle,
A.PaymentReceiptID
,d.Code
,A.CurrencyRate,
case when @CultureNo = 1 then c.Title
	 when @CultureNo = 2 then c.Title2 end Currency,
	 c.CurrencyID,
	 a.PaymentCashID
 ------------------           
FROM FIN.PaymentReceipt S
left join FIN.PaymentCash  A on S.PaymentReceiptID=A.PaymentReceiptID
left join CFG.Cash E on E.CashID=A.CashID
join ACC.DL d on d.DLID=E.DlID
join CFG.Currency c on c.CurrencyID = A.CurrencyID
where  S.PaymentReceiptID in (select id from #Ids)
