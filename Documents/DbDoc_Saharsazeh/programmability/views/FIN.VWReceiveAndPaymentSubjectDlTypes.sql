


	CREATE   VIEW [FIN].[VWReceiveAndPaymentSubjectDlTypes]
	as

		select 'Receive' Type,ps.ReceiveSubjectID SubjectID,pi.Code,pi.Title,pi.Title2,pi.DlID,pi.DlTypeID
		from fin.ReceiveReceipt PR
		join fin.ReceiveSubject PS on ps.ReceiveReceiptID = PR.ReceiveReceiptID
		join 
		(
			select pi.PreVoucherID,pi.RowIndex,dl.Code,dl.Title,dl.Title2,Dl.DlID,dl.DlTypeID
			from acc.PreVoucher p
			join acc.PreVoucherItem pi on p.PreVoucherid = pi.PreVoucherid
			join acc.AccountLevelSL als on als.SlID = pi.SlID
			join acc.PreVoucherItemAccountLevel a on a.PreVoucherItemID = pi.PreVoucherItemID
			join acc.dl on dl.DLID = a.DlID and dl.DlTypeID = als.DlTypeID
			where p.documentnumtypeid = 30 
		) pi on pi.PreVoucherID = pr.PreVoucherID 
		where pi.RowIndex = ps.RowIndex


		UNION ALL


		select 'Payment' Type,ps.PaymentSubjectID SubjectID,pi.Code,pi.Title,pi.Title2,pi.DlID,pi.DlTypeID
		from fin.PaymentReceipt PR
		join fin.PaymentSubject PS on ps.PaymentReceiptID = PR.PaymentReceiptID
		join 
		(
			select pi.PreVoucherID,pi.RowIndex,dl.Code,dl.Title,dl.Title2,Dl.DlID,dl.DlTypeID
			from acc.PreVoucher p
			join acc.PreVoucherItem pi on p.PreVoucherid = pi.PreVoucherid
			join acc.AccountLevelSL als on als.SlID = pi.SlID
			join acc.PreVoucherItemAccountLevel a on a.PreVoucherItemID = pi.PreVoucherItemID
			join acc.dl on dl.DLID = a.DlID and dl.DlTypeID = als.DlTypeID
			where p.documentnumtypeid = 31
		) pi on pi.PreVoucherID = pr.PreVoucherID 
		where pi.RowIndex = ps.RowIndex

