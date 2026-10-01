export const settourQuery = `
  query getSearchGrup(
    $depCityCd: String,
    $travelCd: String,
    $begDt: String!,
    $endDt: String!,
    $keyWord: String,
    $isOrder: Boolean!,
    $isMiniTour: Boolean!,
    $portTp: String!,
    $pageNo: Int!,
    $sort: String!,
    $companyNo: String,
    $minPrice: Int,
    $maxPrice: Int,
    $tourDays: String,
    $isOffer: Boolean!,
    $isMkt: Boolean!,
    $grupStatus: String,
    $isPakFly: Boolean!,
    $isChaFly: Boolean!,
    $isNoShopping: Boolean!,
    $isNoPay: Boolean!,
    $isGoEarly: Boolean!,
    $isLateReturn: Boolean!,
    $isOnlyMiniTour: Boolean!,
    $week: String,
    $airLine: String,
    $memberNo: String,
    $isB2C: Boolean!,
    $hideB2ePrice: Boolean!
  ) {
    getGfgSearchGrup(
      depCityCd: $depCityCd,
      travelCd: $travelCd,
      begDt: $begDt,
      endDt: $endDt,
      keyWord: $keyWord,
      isOrder: $isOrder,
      isMiniTour: $isMiniTour,
      portTp: $portTp,
      pageNo: $pageNo,
      sort: $sort,
      companyNo: $companyNo,
      minPrice: $minPrice,
      maxPrice: $maxPrice,
      tourDays: $tourDays,
      isOffer: $isOffer,
      isMkt: $isMkt,
      grupStatus: $grupStatus,
      isPakFly: $isPakFly,
      isChaFly: $isChaFly,
      isNoShopping: $isNoShopping,
      isNoPay: $isNoPay,
      isGoEarly: $isGoEarly,
      isLateReturn: $isLateReturn,
      isOnlyMiniTour: $isOnlyMiniTour,
      week: $week,
      airLine: $airLine,
      memberNo: $memberNo
    ) {
      error {
        msgCode
      }
      data {
        pageNo
        totalPage
        totalSize
        grup {
          prodType
          opPromote
          prodClass
          prodSub3
          prodNo
          mgrupNo
          grupNo
          grupNm
          depCity
          begDt
          endDt
          tourDays
          tourNights
          orgQty
          allowQty
          allowQtyRemark
          grupStatus
          isChaFly
          isSpl
          isPakFly
          isOfferGrup
          isOkGrup
          saleTag
          grupTp
          grupQty
          jtQty
          allQty
          tktQty
          orderDt
          kkQty
          hkQty
          rrQty
          hlQty
          grupPromote
          grupPromoteText
          isOpControl
          mktInfo
          imageName
          isAddOpen
          saleStatus
          price {
            b2cPrice
            b2bPrice @skip(if:$isB2C)
            b2ePrice @skip(if:$hideB2ePrice)
            b2eContractDiscount
            b2eExtraDiscount
            discount
          }
          linkNo
          isCruises
          deptCd
        }
      }
    }
  }
`;
