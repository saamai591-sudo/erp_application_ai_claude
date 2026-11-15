

CREATE proc [CNT].[getContractSubjectforContactStatement]
@Contract int

--with encryption

as


	select	    x.ContractSubjectID,
                x.ContractID,
                x.RowIndex,
                x.Description,
                x.Description2,
                x.Price+isnull(T.Price,0) Price
	 from cnt.ContractSubject x
left join (
	select		x.ParentID ,
				sum(x.Price) Price
	from cnt.Contract cc
	join cnt.ContractSubject x on x.ContractID = cc.ContractID
	where cc.ParentID = @Contract and x.ParentID is not null
	group by x.ParentID
	)T on T.ParentID = x.ContractSubjectID
	  where x.ContractID = @Contract

	  union all
	select		 x.ContractSubjectID,
                x.ContractID,
                x.RowIndex,
                x.Description,
                x.Description2,
                x.Price Price
	from cnt.Contract cc
	join cnt.ContractSubject x on x.ContractID = cc.ContractID
	where cc.ParentID = @Contract and x.ParentID is null
