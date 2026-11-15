
CREATE   proc [CNT].GetContractSubjectsInLastSupplementary
(
@ContractID int,
@ContractStatementID int
)
as

DECLARE @Culture NVARCHAR(5),
		@CultureNo tinyint

	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

select  a.ContractID,
        a.ContractSubjectID,
		a.FirstPrice,
		a.Issupplementary,
		a.Price,
		a.RowIndex,
		a.stuffid,
		case @CultureNo when 1 then a.Title else a.Title2 end as Title,
		case when b.StatementDeliverySection = 1 then isnull(I.Amount,0) else 0 end StatementAmount,
		a.CurrencyID,
		a.Remain
 from CNT.VWContractSubject a
 join cnt.Contract b
	on a.ContractID = b.ContractID
 left join
 (
	select  ROW_NUMBER() over(partition by ContractSubjectID order by number desc) Rno,
			ContractSubjectID,
			Amount
	from cnt.ContractStatementItem a
	join cnt.ContractStatement b
		on a.ContractStatementID = b.ContractStatementID
	join cnt.ContractStatementType t 
		on t.ContractStatementTypeID = b.ContractStatementTypeID
	where b.ContractStatementID <> @ContractStatementID
	and  t.Type in (1,4)
 ) I
	on I.ContractSubjectID = a.ContractSubjectID
	and I.Rno = 1
where a.ContractID = @ContractID
and a.stuffid is null
